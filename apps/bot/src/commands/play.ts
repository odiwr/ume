import { and, eq, ilike, isNotNull } from 'drizzle-orm'
import { findCommand } from '@ume/shared'
import { playlistTracks, db, touchActivity, tracks } from '../lib/db'
import { findPlaylist } from '../lib/playlists'
import { errorEmbed, formatMs, umeEmbed } from '../lib/embeds'
import type { QueueItem } from '../voice'
import type { Command } from './context'
import { addedByLabel, playlistQueue, itemLabel, requirePlayer } from './playback-shared'

export const play: Command = {
  spec: findCommand('play')!,
  async run(ctx) {
    const ws = ctx.access!.workspace
    const query = ctx.args.query?.trim()
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed('Tell me what to play: a playlist name or part of a track title.', 'What should I play?')] })
      return
    }
    await ctx.defer()
    const player = await requirePlayer(ctx, ws, { joinIfNeeded: true })
    if (!player) return

    const playlist = await findPlaylist(ws.id, query)
    if (playlist) {
      const { items, skippedLinked, notReady } = await playlistQueue(playlist)
      if (!items.length) {
        await ctx.reply({
          embeds: [
            errorEmbed(
              skippedLinked
                ? `**${playlist.name}** only has linked YouTube entries, and their audio is not stored. Upload files on the web to play them.`
                : `**${playlist.name}** has nothing playable yet.`,
              'Nothing to play',
            ),
          ],
        })
        return
      }
      await player.playPlaylist({ id: playlist.id, name: playlist.name }, items)
      await touchActivity(db, ws.id, { kind: 'command', discordUserId: ctx.user.id, metadata: { command: 'play', playlistId: playlist.id } })
      const notes: string[] = []
      if (skippedLinked) notes.push(`${skippedLinked} linked entr${skippedLinked === 1 ? 'y' : 'ies'} skipped (audio not stored)`)
      if (notReady) notes.push(`${notReady} still processing`)
      await ctx.reply({
        embeds: [
          umeEmbed({
            title: `Playing ${playlist.name}`,
            description: `${items.length} track${items.length === 1 ? '' : 's'}, shuffled, on repeat.${notes.length ? `\n_${notes.join(' · ')}_` : ''}`,
            fields: player.current ? [{ name: 'Now playing', value: `${itemLabel(player.current)} · ${formatMs(player.current.track.durationMs)}` }] : [],
          }),
        ],
        ephemeral: false,
      })
      return
    }

    // Track title search across the workspace (ready + stored only).
    const found = await db.query.tracks.findMany({
      where: and(eq(tracks.workspaceId, ws.id), eq(tracks.status, 'ready'), isNotNull(tracks.storageKey), ilike(tracks.title, `%${query.replace(/[%_]/g, '\\$&')}%`)),
      limit: 10,
    })
    if (!found.length) {
      await ctx.reply({ embeds: [errorEmbed(`No playlist or track matches **${query}**. Try \`/playlists\` to see what is here.`, 'Nothing found')] })
      return
    }
    const items: QueueItem[] = []
    for (const t of found) {
      const entry = await db.query.playlistTracks.findFirst({
        where: eq(playlistTracks.trackId, t.id),
        with: { playlist: { columns: { name: true } }, addedBy: { columns: { name: true } } },
      })
      items.push({ track: t, playlistName: entry?.playlist.name ?? null, addedBy: entry ? addedByLabel(entry) : null })
    }
    await player.playItems(items)
    await touchActivity(db, ws.id, { kind: 'command', discordUserId: ctx.user.id, metadata: { command: 'play', query } })
    await ctx.reply({
      embeds: [
        umeEmbed({
          title: items.length === 1 ? `Playing ${itemLabel(items[0]!)}` : `Playing ${items.length} matches for “${query}”`,
          description: items.length > 1 ? items.map((i, n) => `${n + 1}. ${itemLabel(i)}`).join('\n') : undefined,
          thumbnail: items[0]!.track.coverUrl ?? undefined,
        }),
      ],
      ephemeral: false,
    })
  },
}
