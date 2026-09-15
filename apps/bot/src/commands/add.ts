import { and, eq, sql } from 'drizzle-orm'
import { JOBS, findCommand, getPlan, newId, parseYouTubeId } from '@ume/shared'
import { playlistTracks, db, getFlag, logAudit, recountPlaylist, touchActivity, tracks } from '../lib/db'
import { enqueue } from '../lib/queue'
import { findPlaylist, invalidatePlaylistCache, listPlaylists } from '../lib/playlists'
import { errorEmbed, umeEmbed } from '../lib/embeds'
import { logger } from '../lib/logger'
import type { Command } from './context'

interface OEmbed {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

async function fetchOEmbed(videoUrl: string): Promise<OEmbed | null> {
  const url = new URL('https://www.youtube.com/oembed')
  url.searchParams.set('url', videoUrl)
  url.searchParams.set('format', 'json')
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) }).catch(() => null)
  if (!res || !res.ok) return null
  return (await res.json().catch(() => null)) as OEmbed | null
}

export const add: Command = {
  spec: findCommand('add')!,
  async run(ctx) {
    const access = ctx.access!
    const ws = access.workspace
    const playlistArg = ctx.args.playlist?.trim()
    const urlArg = ctx.args.url?.trim()
    if (!playlistArg || !urlArg) {
      await ctx.reply({ embeds: [errorEmbed('Usage: `/add playlist:<name> url:<YouTube link>` or `~add city-pop https://youtu.be/…`', 'Missing arguments')] })
      return
    }
    await ctx.defer()

    if (!ws.linkExtractEnabled) {
      await ctx.reply({ embeds: [errorEmbed('YouTube links are turned off for this server (Settings → Library).', 'YouTube disabled')] })
      return
    }
    const sourceId = parseYouTubeId(urlArg)
    if (!sourceId) {
      await ctx.reply({ embeds: [errorEmbed('That does not look like a YouTube video link. Try `https://www.youtube.com/watch?v=…` or `https://youtu.be/…`.', 'Not a YouTube link')] })
      return
    }

    const playlist = await findPlaylist(ws.id, playlistArg)
    if (!playlist) {
      const all = await listPlaylists(ws.id)
      const list = all.length ? all.map((b) => `• **${b.name}** (\`${b.slug}\`)`).join('\n') : '_No playlists yet — create one on the web._'
      await ctx.reply({ embeds: [errorEmbed(`No playlist called **${playlistArg}**. Playlists in this server:\n${list}`, 'Playlist not found')] })
      return
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${sourceId}`
    const ingest = await getFlag(db, 'link_extract')
    const userId = access.user?.id ?? null

    let track = await db.query.tracks.findFirst({ where: and(eq(tracks.workspaceId, ws.id), eq(tracks.sourceId, sourceId)) })
    let created = false
    if (!track) {
      const plan = getPlan(ws.plan)
      if (ws.trackCount >= plan.maxTracks) {
        await ctx.reply({ embeds: [errorEmbed(`This server is at its ${plan.name} plan limit of ${plan.maxTracks.toLocaleString('en-US')} tracks.`, 'Track limit reached')] })
        return
      }
      const meta = await fetchOEmbed(canonicalUrl)
      if (!meta?.title) {
        await ctx.reply({ embeds: [errorEmbed('YouTube did not return details for that video. It may be private, removed, or age-restricted.', 'Video unavailable')] })
        return
      }
      const [row] = await db
        .insert(tracks)
        .values({
          id: newId('track'),
          workspaceId: ws.id,
          source: 'link',
          status: ingest ? 'pending' : 'ready',
          title: meta.title.slice(0, 200),
          artist: meta.author_name?.slice(0, 200) ?? null,
          coverUrl: meta.thumbnail_url ?? null,
          storageKey: null,
          sourceId,
          sourceUrl: canonicalUrl,
          sourceAuthor: meta.author_name ?? null,
          uploadedByUserId: userId,
          uploadedByDiscordId: ctx.user.id,
          addedVia: 'discord',
          readyAt: ingest ? null : new Date(),
        })
        .onConflictDoNothing()
        .returning()
      track = row ?? (await db.query.tracks.findFirst({ where: and(eq(tracks.workspaceId, ws.id), eq(tracks.sourceId, sourceId)) }))
      created = !!row
      if (!track) throw new Error('Could not save the track.')
      if (created && ingest) {
        try {
          await enqueue(JOBS.extractLink, { trackId: track.id, workspaceId: ws.id, sourceId, requestedByUserId: userId, requestedByDiscordId: ctx.user.id })
        } catch (err) {
          logger.warn({ err, trackId: track.id }, 'failed to enqueue YouTube ingest')
        }
      }
    }

    const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id))
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
    if (created) {
      await db.update(tracks).set({ updatedAt: new Date() }).where(eq(tracks.id, track.id))
    }
    invalidatePlaylistCache(ctx.guild!.id)
    await touchActivity(db, ws.id, { kind: 'command', discordUserId: ctx.user.id, userId, metadata: { command: 'add', trackId: track.id } })
    await logAudit(db, {
      workspaceId: ws.id,
      actorDiscordId: ctx.user.id,
      actorUserId: userId,
      action: created ? 'track.add' : 'playlist.track.add',
      targetType: 'track',
      targetId: track.id,
      metadata: { playlistId: playlist.id, sourceId, alreadyInPlaylist: !entry },
    })

    const state = !entry
      ? 'Already in this playlist.'
      : track.status === 'ready' && !track.storageKey
        ? 'Linked entry — audio is not stored, so it is skipped during playback.'
        : track.status === 'pending' || track.status === 'processing'
          ? 'Queued for ingest — playable once the worker finishes.'
          : 'Ready to play.'
    await ctx.reply({
      embeds: [
        umeEmbed({
          title: track.title,
          url: canonicalUrl,
          thumbnail: track.coverUrl ?? undefined,
          description: track.artist ? `by ${track.artist}` : undefined,
          fields: [
            { name: 'Playlist', value: playlist.name, inline: true },
            { name: 'Added by', value: `<@${ctx.user.id}>`, inline: true },
            { name: 'Status', value: state, inline: false },
          ],
        }),
      ],
      ephemeral: false,
    })
  },
}
