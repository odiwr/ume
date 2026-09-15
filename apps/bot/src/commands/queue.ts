import { findCommand } from '@ume/shared'
import { getPlayer } from '../voice'
import { formatMs, umeEmbed } from '../lib/embeds'
import { itemLabel } from './playback-shared'
import type { Command } from './context'

export const queue: Command = {
  spec: findCommand('queue')!,
  async run(ctx) {
    const player = getPlayer(ctx.guild!.id)
    if (!player || (!player.current && !player.queue.length)) {
      await ctx.reply({ embeds: [umeEmbed({ title: 'Queue is empty', description: 'Start a playlist with `/play <playlist>`.' })] })
      return
    }
    const upNext = player.queue.slice(0, 10)
    const lines = upNext.map((i, n) => `${n + 1}. ${itemLabel(i)} · ${formatMs(i.track.durationMs)}`)
    const remaining = player.queue.length - upNext.length
    await ctx.reply({
      embeds: [
        umeEmbed({
          title: player.playlist ? `Queue — ${player.playlist.name} (shuffled, on repeat)` : 'Queue',
          fields: [
            ...(player.current ? [{ name: 'Now playing', value: `${itemLabel(player.current)} · ${formatMs(player.elapsedMs)} / ${formatMs(player.current.track.durationMs)}` }] : []),
            { name: 'Up next', value: lines.length ? `${lines.join('\n')}${remaining > 0 ? `\n…and ${remaining} more` : ''}` : player.playlist ? 'Reshuffling the playlist after this one.' : 'Nothing else.' },
          ],
        }),
      ],
    })
  },
}
