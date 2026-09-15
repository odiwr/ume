import { findCommand } from '@ume/shared'
import { getPlayer } from '../voice'
import { errorEmbed, successEmbed } from '../lib/embeds'
import type { Command } from './context'

export const pause: Command = {
  spec: findCommand('pause')!,
  async run(ctx) {
    const player = getPlayer(ctx.guild!.id)
    if (!player?.current) {
      await ctx.reply({ embeds: [errorEmbed('Nothing is playing.', 'Nothing to pause')] })
      return
    }
    if (player.isPaused) {
      await ctx.reply({ embeds: [successEmbed('Already paused. `/resume` to continue.')] })
      return
    }
    player.pause()
    await ctx.reply({ embeds: [successEmbed('Paused. `/resume` when you are ready.')], ephemeral: false })
  },
}
