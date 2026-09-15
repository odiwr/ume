import { findCommand } from '@ume/shared'
import { listPlaylists } from '../lib/playlists'
import { env } from '../lib/env'
import { formatMs, umeEmbed } from '../lib/embeds'
import type { Command } from './context'

export const playlists: Command = {
  spec: findCommand('playlists')!,
  async run(ctx) {
    const ws = ctx.access!.workspace
    const all = await listPlaylists(ws.id)
    const dash = `${env.appUrl}/app/${ws.umeId}`
    if (!all.length) {
      await ctx.reply({
        embeds: [umeEmbed({ title: `${ctx.guild!.name} has no playlists yet`, description: `Create one at ${dash} and drop some music in.` })],
      })
      return
    }
    const lines = all
      .slice(0, 40)
      .map((b) => `${b.emoji ? `${b.emoji} ` : ''}**${b.name}** — ${b.trackCount} track${b.trackCount === 1 ? '' : 's'} · ${formatMs(b.totalDurationMs)}`)
    const totalTracks = all.reduce((n, b) => n + b.trackCount, 0)
    const totalMs = all.reduce((n, b) => n + b.totalDurationMs, 0)
    await ctx.reply({
      embeds: [
        umeEmbed({
          title: `Playlists in ${ctx.guild!.name}`,
          description: `${lines.join('\n')}${all.length > 40 ? `\n…and ${all.length - 40} more` : ''}`,
          fields: [{ name: 'Total', value: `${all.length} playlists · ${totalTracks} tracks · ${formatMs(totalMs)}` }],
          footer: `Play one with /play <playlist> · ${dash}`,
        }),
      ],
    })
  },
}
