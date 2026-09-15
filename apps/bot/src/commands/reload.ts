import { eq } from '../lib/orm'
import { findCommand } from '@ume/shared'
import { sendEmail, tokenRotatedEmail } from '@ume/email'
import { db, issueClaimToken, logAudit, users } from '../lib/db'
import { env } from '../lib/env'
import { umeEmbed } from '../lib/embeds'
import { logger } from '../lib/logger'
import type { Command } from './context'
import { resolveTargetGuild } from './setup-shared'

export const reload: Command = {
  spec: findCommand('reload')!,
  async run(ctx) {
    await ctx.defer()
    const guild = await resolveTargetGuild(ctx, 'admin')
    if (!guild) return

    const result = await issueClaimToken(db, {
      guildId: guild.id,
      guildName: guild.name,
      guildIcon: guild.icon,
      guildOwnerDiscordId: guild.ownerId,
      issuedToDiscordId: ctx.user.id,
    })

    await logAudit(db, {
      workspaceId: result.workspace.id,
      actorDiscordId: ctx.user.id,
      action: 'token.rotate',
      targetType: 'workspace',
      targetId: result.workspace.id,
      metadata: { disconnected: result.disconnected, via: ctx.source, inGuild: !!ctx.guild },
    })

    const embed = umeEmbed({
      title: `Your Ume token for ${guild.name}`,
      description: [
        '```',
        result.token,
        '```',
        '**Single use · expires in 24 hours.** Anyone with it can claim this server, so treat it like a password.',
        '',
        `1. Open ${env.appUrl}/app/claim`,
        '2. Sign in with Discord',
        '3. Paste the token',
        '',
        result.disconnected
          ? 'The existing workspace is now **disconnected** (read-only) until the new token is entered. Members and music are untouched.'
          : result.workspace.ownerUserId
            ? 'The workspace stays read-only until this token is entered.'
            : 'Entering the token creates the workspace and makes you its Owner.',
      ].join('\n'),
      footer: 'Never paste this token in a public channel.',
    })

    await ctx.reply({ embeds: [embed], ephemeral: true })

    // Ephemeral replies vanish; a DM copy survives.
    if (ctx.guild) {
      await ctx.user.send({ embeds: [embed] }).catch((err) => {
        logger.info({ err: err?.code ?? err, userId: ctx.user.id }, 'could not DM token copy (DMs closed?)')
      })
    }

    if (result.disconnected && result.workspace.ownerUserId) {
      const owner = await db.query.users.findFirst({ where: eq(users.id, result.workspace.ownerUserId) })
      if (owner) {
        const settingsUrl = `${env.appUrl}/app/${result.workspace.umeId}/settings`
        try {
          await sendEmail(tokenRotatedEmail({ to: owner.email, serverName: guild.name, settingsUrl }))
        } catch (err) {
          logger.warn({ err }, 'tokenRotated email failed')
        }
        if (owner.discordUserId && owner.discordUserId !== ctx.user.id) {
          try {
            const u = await ctx.client.users.fetch(owner.discordUserId)
            await u.send({
              embeds: [
                umeEmbed({
                  title: `Ume token rotated for ${guild.name}`,
                  description: `<@${ctx.user.id}> ran \`/reload\`. The web workspace is disconnected until the new token is entered at ${settingsUrl}.`,
                  thumbnail: null,
                }),
              ],
            })
          } catch (err) {
            // 50007: Cannot send messages to this user.
            logger.info({ code: (err as { code?: number })?.code }, 'could not DM previous owner')
          }
        }
      }
    }
  },
}
