import { findCommand } from '@ume/shared'
import { getPlayer } from '../voice'
import { errorEmbed, successEmbed } from '../lib/embeds'
import type { Command } from './context'

export const resume: Command = {
  spec: findCommand('resume')!,
  async run(ctx) {
    const player = getPlayer(ctx.guild!.id)
    if (!player) {
      await ctx.reply({ embeds: [errorEmbed('Nothing to resume. Start something with `/play`.', 'Nothing queued')] })
      return
    }
    if (player.isPaused) {
      player.unpause()
      await ctx.reply({ embeds: [successEmbed('Resumed.')], ephemeral: false })
      return
    }
    if (!player.current && (await player.restartLastPlaylist())) {
      await ctx.reply({ embeds: [successEmbed(`Restarted **${player.playlist?.name}**.`)], ephemeral: false })
      return
    }
    await ctx.reply({ embeds: [successEmbed(player.isPlaying ? 'Already playing.' : 'Nothing to resume. Start something with `/play`.')] })
  },
}
