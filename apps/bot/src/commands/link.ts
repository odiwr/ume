import { findCommand } from '@ume/shared'
import { db, getWorkspaceByGuildId } from '../lib/db'
import { env } from '../lib/env'
import { umeEmbed } from '../lib/embeds'
import type { Command } from './context'

export const link: Command = {
  spec: findCommand('link')!,
  async run(ctx) {
    const ws = ctx.guild ? (ctx.access?.workspace ?? (await getWorkspaceByGuildId(db, ctx.guild.id))) : null
    if (ws && ws.status !== 'purged') {
      const url = `${env.appUrl}/app/${ws.umeId}`
      await ctx.reply({
        embeds: [umeEmbed({ title: `${ws.guildName} on Ume`, url, description: `${url}\n\nSign in with Discord to see the playlists you have access to.` })],
      })
      return
    }
    await ctx.reply({
      embeds: [
        umeEmbed({
          title: 'Your Ume dashboard',
          url: `${env.appUrl}/app`,
          description: `${env.appUrl}/app\n\nSign in with Discord to see your servers.${ctx.guild ? ' This server is not set up yet — an admin can run `/reload` or claim it on the web.' : ''}`,
        }),
      ],
    })
  },
}
