import { findCommand } from '@ume/shared'
import { getPlayer } from '../voice'
import { errorEmbed, successEmbed } from '../lib/embeds'
import { itemLabel } from './playback-shared'
import type { Command } from './context'

export const skip: Command = {
  spec: findCommand('skip')!,
  async run(ctx) {
    const player = getPlayer(ctx.guild!.id)
    if (!player?.current) {
      await ctx.reply({ embeds: [errorEmbed('Nothing is playing.', 'Nothing to skip')] })
      return
    }
    const skipped = itemLabel(player.current)
    player.skip()
    await ctx.reply({ embeds: [successEmbed(`Skipped **${skipped}**.`)], ephemeral: false })
  },
}
