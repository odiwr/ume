import { findCommand } from '@ume/shared'
import { getPlayer } from '../voice'
import { errorEmbed, successEmbed } from '../lib/embeds'
import type { Command } from './context'

export const stop: Command = {
  spec: findCommand('stop')!,
  async run(ctx) {
    const player = getPlayer(ctx.guild!.id)
    if (!player || (!player.current && !player.queue.length)) {
      await ctx.reply({ embeds: [errorEmbed('Nothing is playing.', 'Already stopped')] })
      return
    }
    player.stop()
    await ctx.reply({ embeds: [successEmbed('Stopped and cleared the queue. I am staying in the channel — `/play` whenever.')], ephemeral: false })
  },
}
