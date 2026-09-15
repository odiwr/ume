import { randomUUID } from 'node:crypto'
import { DANGER_CONFIRM_TTL_MS, generateConfirmCode, hashToken } from '@ume/shared'
import { dangerConfirmations, db } from '../lib/db'
import { DANGER, umeEmbed } from '../lib/embeds'
import type { CommandContext } from './context'
import { resolveTargetGuild, requireWorkspace } from './setup-shared'

/** Shared flow for ~reset / ~purge: pick the guild, mint a code, explain the consequences. */
export async function requestDangerAction(ctx: CommandContext, action: 'reset' | 'purge', consequences: string[]): Promise<void> {
  await ctx.defer()
  const guild = await resolveTargetGuild(ctx, 'owner')
  if (!guild) return
  const ws = await requireWorkspace(ctx, guild)
  if (!ws) return

  const code = generateConfirmCode()
  const expiresAt = new Date(Date.now() + DANGER_CONFIRM_TTL_MS)
  await db.insert(dangerConfirmations).values({
    id: `dc_${randomUUID()}`,
    workspaceId: ws.id,
    action,
    codeHash: hashToken(code),
    requestedByDiscordId: ctx.user.id,
    expiresAt,
  })

  const minutes = Math.round(DANGER_CONFIRM_TTL_MS / 60_000)
  await ctx.reply({
    embeds: [
      umeEmbed({
        title: action === 'purge' ? `Purge ${guild.name}?` : `Reset ${guild.name}?`,
        color: DANGER,
        thumbnail: null,
        description: [
          'This will:',
          ...consequences.map((c) => `• ${c}`),
          '',
          `To go ahead, reply with \`~confirm ${code}\` (or \`/confirm ${code}\`) within ${minutes} minutes.`,
          'Ignore this message to cancel — nothing happens without the code.',
        ].join('\n'),
        footer: `Code expires ${expiresAt.toUTCString()}`,
      }),
    ],
    ephemeral: true,
  })
}
