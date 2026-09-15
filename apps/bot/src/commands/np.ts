import { findCommand } from '@ume/shared'
import { getPlayer } from '../voice'
import { formatMs, umeEmbed } from '../lib/embeds'
import type { Command } from './context'

function progressBar(elapsed: number, total: number | null | undefined, width = 16): string {
  if (!total || total <= 0) return ''
  const filled = Math.min(width, Math.round((elapsed / total) * width))
  return `${'━'.repeat(filled)}●${'─'.repeat(Math.max(0, width - filled))}`
}

export const np: Command = {
  spec: findCommand('np')!,
  async run(ctx) {
    const player = getPlayer(ctx.guild!.id)
    const cur = player?.current
    if (!player || !cur) {
      await ctx.reply({ embeds: [umeEmbed({ title: 'Nothing playing', description: 'Start a playlist with `/play <playlist>`.' })] })
      return
    }
    const elapsed = player.elapsedMs
    await ctx.reply({
      embeds: [
        umeEmbed({
          title: cur.track.title,
          description: [
            cur.track.artist ? `by **${cur.track.artist}**${cur.track.album ? ` · ${cur.track.album}` : ''}` : cur.track.album ?? undefined,
            `${progressBar(elapsed, cur.track.durationMs)} ${formatMs(elapsed)} / ${formatMs(cur.track.durationMs)}${player.isPaused ? ' · paused' : ''}`,
          ]
            .filter(Boolean)
            .join('\n'),
          thumbnail: cur.track.coverUrl ?? undefined,
          fields: [
            { name: 'Playlist', value: cur.playlistName ?? '—', inline: true },
            { name: 'Added by', value: cur.addedBy ?? '—', inline: true },
            { name: 'Plays', value: String(cur.track.playCount + 1), inline: true },
          ],
        }),
      ],
    })
  },
}
