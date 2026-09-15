import { INACTIVITY, findCommand, formatBytes, getPlan, isPaidPlan } from '@ume/shared'
import { db, effectiveQuotaBytes, getLiveTokenMeta } from '../lib/db'
import { env } from '../lib/env'
import { relTime, umeEmbed } from '../lib/embeds'
import { voice } from '../voice'
import type { Command } from './context'

export const status: Command = {
  spec: findCommand('status')!,
  async run(ctx) {
    const ws = ctx.access!.workspace
    const guild = ctx.guild!
    const v = voice()
    const connected = v.isConnected(guild.id)
    const quota = effectiveQuotaBytes(ws)
    const pct = quota > 0 ? Math.min(100, Math.round((ws.storageUsedBytes / quota) * 100)) : 0
    const plan = getPlan(ws.plan)
    const live = await getLiveTokenMeta(db, guild.id)

    const idleDays = Math.floor((Date.now() - ws.lastActivityAt.getTime()) / 86_400_000)
    const purgeLine = isPaidPlan(ws.plan)
      ? 'Never auto-removed (paid plan).'
      : `${Math.max(0, INACTIVITY.purgeAfterDays - idleDays)} days of inactivity left before auto-purge.`

    await ctx.reply({
      embeds: [
        umeEmbed({
          title: `Ume status — ${guild.name}`,
          fields: [
            { name: 'Workspace', value: `**${ws.status}** · \`${ws.umeId}\``, inline: false },
            {
              name: 'Voice',
              value: ws.homeVoiceChannelId ? `${connected ? 'Connected to' : 'Not connected to'} <#${ws.homeVoiceChannelId}>` : 'No home channel — run `/home`',
              inline: false,
            },
            { name: 'Storage', value: `${formatBytes(ws.storageUsedBytes)} / ${formatBytes(quota)} (${pct}%) · ${plan.name} plan`, inline: true },
            { name: 'Tracks', value: String(ws.trackCount), inline: true },
            { name: 'Last activity', value: `${relTime(ws.lastActivityAt)}\n${purgeLine}`, inline: false },
            ...(live
              ? [{ name: 'Pending token', value: `Issued ${relTime(live.issuedAt)} to <@${live.issuedToDiscordId}>, expires ${relTime(live.expiresAt)}.`, inline: false }]
              : []),
          ],
          footer: `${env.appUrl}/app/${ws.umeId}`,
        }),
      ],
    })
  },
}
