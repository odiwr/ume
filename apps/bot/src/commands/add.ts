import { JOBS, SUPPORTED_LINK_SITES, findCommand, getPlan, linkSiteLabel, mediaLinkSchema, newId, parseMediaLink } from '@ume/shared'
import { and, eq, sql } from '../lib/orm'
import { db, getFlag, logAudit, playlistTracks, recountPlaylist, touchActivity, tracks } from '../lib/db'
import { env } from '../lib/env'
import { enqueue } from '../lib/queue'
import { lookupLinkMeta } from '../lib/links'
import { findPlaylist, invalidatePlaylistCache, listPlaylists } from '../lib/playlists'
import { errorEmbed, umeEmbed } from '../lib/embeds'
import { logger } from '../lib/logger'
import type { Command } from './context'

/**
 * `/add <playlist> <url>` — add a song from a link. The bot only records the entry and
 * (when allowed) asks the worker to extract the audio; it never downloads anything itself.
 *
 * Extraction needs all three: the global `link_extract` flag, the workspace switch, and
 * the Owner's rights attestation. Otherwise the track is a metadata-only entry that
 * playback skips.
 */
export const add: Command = {
  spec: findCommand('add')!,
  async run(ctx) {
    const access = ctx.access!
    const ws = access.workspace
    const guild = ctx.guild!
    const playlistArg = ctx.args.playlist?.trim()
    const urlArg = ctx.args.url?.trim()
    if (!playlistArg || !urlArg) {
      await ctx.reply({
        embeds: [
          errorEmbed(
            'Usage: `/add playlist:<name> url:<link>` or `~add city-pop https://www.youtube.com/watch?v=…`\n' +
              `Supported: ${SUPPORTED_LINK_SITES.map((s) => s.label).join(', ')}.`,
            'Missing arguments',
          ),
        ],
      })
      return
    }

    const parsed = mediaLinkSchema.safeParse(urlArg)
    const link = parsed.success ? parseMediaLink(parsed.data) : null
    if (!link) {
      const why = parsed.success ? 'That link is not a single track.' : (parsed.error.issues[0]?.message ?? 'That link is not supported.')
      await ctx.reply({ embeds: [errorEmbed(why, 'Not a supported link')] })
      return
    }

    await ctx.defer()

    const playlist = await findPlaylist(ws.id, playlistArg)
    if (!playlist) {
      const all = await listPlaylists(ws.id)
      const list = all.length
        ? all
            .slice(0, 20)
            .map((p) => `• **${p.name}** (\`${p.slug}\`)`)
            .join('\n')
        : `_No playlists yet — create one at ${env.appUrl}/app/${ws.umeId}._`
      await ctx.reply({ embeds: [errorEmbed(`No playlist called **${playlistArg}**. Playlists in this server:\n${list}`, 'Playlist not found')] })
      return
    }

    const userId = access.user?.id ?? null
    const globalOn = await getFlag(db, 'link_extract')
    const extractAllowed = globalOn && ws.linkExtractEnabled && ws.linkExtractAcceptedAt != null

    // Dedupe per workspace by (site, id): the same song added twice is one track in two playlists.
    const existingWhere = and(eq(tracks.workspaceId, ws.id), eq(tracks.sourceSite, link.site), eq(tracks.sourceId, link.id))
    let track = await db.query.tracks.findFirst({ where: existingWhere })
    let created = false
    let queued = false
    if (!track) {
      const plan = getPlan(ws.plan)
      if (ws.trackCount >= plan.maxTracks) {
        await ctx.reply({
          embeds: [errorEmbed(`This server is at its ${plan.name} plan limit of ${plan.maxTracks.toLocaleString('en-US')} tracks.`, 'Track limit reached')],
        })
        return
      }
      const meta = await lookupLinkMeta(link)
      const [row] = await db
        .insert(tracks)
        .values({
          id: newId('track'),
          workspaceId: ws.id,
          source: 'link',
          status: extractAllowed ? 'pending' : 'ready',
          title: meta.title,
          artist: meta.author,
          coverUrl: meta.coverUrl,
          storageKey: null,
          sourceSite: link.site,
          sourceId: link.id,
          sourceUrl: link.canonicalUrl,
          sourceAuthor: meta.author,
          uploadedByUserId: userId,
          uploadedByDiscordId: ctx.user.id,
          addedVia: 'discord',
          readyAt: extractAllowed ? null : new Date(),
        })
        .onConflictDoNothing()
        .returning()
      track = row ?? (await db.query.tracks.findFirst({ where: existingWhere }))
      created = !!row
      if (!track) throw new Error('Could not save the track.')
      if (created && extractAllowed) {
        try {
          await enqueue(
            JOBS.extractLink,
            {
              trackId: track.id,
              workspaceId: ws.id,
              sourceSite: link.site,
              sourceId: link.id,
              sourceUrl: link.canonicalUrl,
              requestedByUserId: userId,
              requestedByDiscordId: ctx.user.id,
            },
            { singletonKey: `extract:${track.id}` },
          )
          queued = true
        } catch (err) {
          logger.warn({ err, trackId: track.id }, 'failed to enqueue link extraction')
        }
      }
    }

    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlist.id))
    const [entry] = await db
      .insert(playlistTracks)
      .values({
        id: newId('playlistTrack'),
        playlistId: playlist.id,
        trackId: track.id,
        workspaceId: ws.id,
        addedByUserId: userId,
        addedByDiscordId: ctx.user.id,
        addedVia: 'discord',
        position: count?.n ?? 0,
      })
      .onConflictDoNothing()
      .returning({ id: playlistTracks.id })

    await recountPlaylist(db, playlist.id)
    invalidatePlaylistCache(guild.id)
    await touchActivity(db, ws.id, {
      kind: 'command',
      discordUserId: ctx.user.id,
      userId,
      metadata: { command: 'add', trackId: track.id, site: link.site },
    })
    await logAudit(db, {
      workspaceId: ws.id,
      actorDiscordId: ctx.user.id,
      actorUserId: userId,
      action: created ? 'track.add' : 'playlist.track.add',
      targetType: 'track',
      targetId: track.id,
      metadata: { playlistId: playlist.id, sourceSite: link.site, sourceId: link.id, alreadyInPlaylist: !entry, queued },
    })

    const settingsUrl = `${env.appUrl}/app/${ws.umeId}/settings`
    let state: string
    if (!entry) {
      state = 'Already in this playlist.'
    } else if (track.status === 'ready' && track.storageKey) {
      state = 'Ready to play.'
    } else if (track.status === 'pending' || track.status === 'processing') {
      state = queued || !created ? 'Queued for extraction — playable once the worker finishes.' : 'Saved; extraction will be queued on the next try.'
    } else if (track.status === 'failed') {
      state = `Extraction failed earlier${track.errorMessage ? `: ${track.errorMessage}` : ''}. Re-add it from the web to retry.`
    } else if (track.status === 'disabled') {
      state = 'This track was taken down and cannot be played.'
    } else if (!globalOn) {
      state = 'Saved as a link-only entry (no audio stored) — the link extractor is switched off right now.'
    } else if (!ws.linkExtractEnabled) {
      state = `Saved as a link-only entry (no audio stored) — adding songs from links is turned off in this server’s Settings: ${settingsUrl}`
    } else {
      state = `Saved as a link-only entry (no audio stored). The Owner can turn on extraction by accepting the rights attestation in Settings: ${settingsUrl}`
    }

    await ctx.reply({
      embeds: [
        umeEmbed({
          title: track.title,
          url: track.sourceUrl ?? link.canonicalUrl,
          thumbnail: track.coverUrl ?? undefined,
          description: track.artist ? `by ${track.artist}` : undefined,
          fields: [
            { name: 'Playlist', value: playlist.name, inline: true },
            { name: 'Source', value: linkSiteLabel(link.site), inline: true },
            { name: 'Added by', value: `<@${ctx.user.id}>`, inline: true },
            { name: 'Status', value: state, inline: false },
          ],
        }),
      ],
      ephemeral: false,
    })
  },
}
