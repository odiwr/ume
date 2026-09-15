import { and, eq, gt, isNull } from '../lib/orm'
import { JOBS, findCommand, hashToken } from '@ume/shared'
import {
  claimTokens,
  dangerConfirmations,
  db,
  getWorkspaceById,
  invites,
  logAudit,
  removeAllMembersExceptOwner,
  workspaces,
} from '../lib/db'
import { enqueue } from '../lib/queue'
import { errorEmbed, successEmbed } from '../lib/embeds'
import { logger } from '../lib/logger'
import { voice } from '../voice'
import type { Command } from './context'
import { linkedUserId } from './setup-shared'

export const confirm: Command = {
  spec: findCommand('confirm')!,
  async run(ctx) {
    await ctx.defer()
    const code = (ctx.args.code ?? '').trim().toUpperCase()
    if (!/^[A-Z2-7]{6}$/.test(code)) {
      await ctx.reply({ embeds: [errorEmbed('Codes are 6 characters, like `K7Q2ZP`.', 'Invalid code')] })
      return
    }

    const now = new Date()
    const candidates = await db.query.dangerConfirmations.findMany({
      where: and(
        eq(dangerConfirmations.codeHash, hashToken(code)),
        isNull(dangerConfirmations.consumedAt),
        gt(dangerConfirmations.expiresAt, now),
      ),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 5,
    })

    // Authorization: the person who requested it, the guild owner, or the workspace Owner.
    const webUserId = await linkedUserId(ctx.user.id)
    let match: (typeof candidates)[number] | null = null
    let ws: Awaited<ReturnType<typeof getWorkspaceById>> | undefined
    for (const c of candidates) {
      const w = await getWorkspaceById(db, c.workspaceId)
      if (!w) continue
      if (ctx.guild && w.guildId !== ctx.guild.id) continue
      const guild = ctx.client.guilds.cache.get(w.guildId)
      const authorized =
        c.requestedByDiscordId === ctx.user.id ||
        guild?.ownerId === ctx.user.id ||
        (!!webUserId && w.ownerUserId === webUserId)
      if (authorized) {
        match = c
        ws = w
        break
      }
    }
    if (!match || !ws) {
      await ctx.reply({
        embeds: [errorEmbed('No pending action matches that code. Codes expire after 5 minutes — run the command again.', 'Nothing to confirm')],
      })
      return
    }

    const [consumed] = await db
      .update(dangerConfirmations)
      .set({ consumedAt: now })
      .where(and(eq(dangerConfirmations.id, match.id), isNull(dangerConfirmations.consumedAt)))
      .returning({ id: dangerConfirmations.id })
    if (!consumed) {
      await ctx.reply({ embeds: [errorEmbed('That code was already used.', 'Nothing to confirm')] })
      return
    }

    if (match.action === 'reset') {
      const removed = await removeAllMembersExceptOwner(db, ws.id)
      await db
        .update(claimTokens)
        .set({ revokedAt: now })
        .where(and(eq(claimTokens.workspaceId, ws.id), isNull(claimTokens.claimedAt), isNull(claimTokens.revokedAt)))
      await db.update(invites).set({ revokedAt: now }).where(and(eq(invites.workspaceId, ws.id), isNull(invites.revokedAt)))
      await db
        .update(workspaces)
        .set({ status: 'disconnected', disconnectedAt: now, updatedAt: now })
        .where(eq(workspaces.id, ws.id))
      await logAudit(db, {
        workspaceId: ws.id,
        actorDiscordId: ctx.user.id,
        actorUserId: webUserId,
        action: 'workspace.reset',
        targetType: 'workspace',
        targetId: ws.id,
        metadata: { removedMembers: removed, confirmationId: match.id },
      })
      await ctx.reply({
        embeds: [
          successEmbed(
            `Removed ${removed} member${removed === 1 ? '' : 's'}, revoked all invites, and disconnected the workspace. Playlists and music are intact.\n\nRun \`/reload\` and enter the new token on the web to reconnect.`,
            `${ws.guildName} has been reset`,
          ),
        ],
      })
      return
    }

    // purge
    try {
      voice().leave(ws.guildId)
    } catch (err) {
      logger.warn({ err, guildId: ws.guildId }, 'leave before purge failed')
    }
    await db
      .update(workspaces)
      .set({ status: 'purging', botConnected: false, botVoiceChannelId: null, updatedAt: now })
      .where(eq(workspaces.id, ws.id))
    await logAudit(db, {
      workspaceId: ws.id,
      actorDiscordId: ctx.user.id,
      actorUserId: webUserId,
      action: 'purge.confirm',
      targetType: 'workspace',
      targetId: ws.id,
      metadata: { confirmationId: match.id },
    })
    try {
      await enqueue(JOBS.purgeWorkspace, { workspaceId: ws.id, reason: 'owner', requestedByDiscordId: ctx.user.id, requestedByUserId: webUserId }, { singletonKey: `purge:${ws.id}` })
    } catch (err) {
      logger.error({ err, workspaceId: ws.id }, 'failed to enqueue purge; the daily reconcile will pick up the purging status')
    }
    await ctx.reply({
      embeds: [
        successEmbed(
          'Playback stopped and the workspace is marked for deletion. Storage is wiped in the background within a few minutes.\n\nIf you ever want Ume back, run `/reload` after the purge completes.',
          `${ws.guildName} is being purged`,
        ),
      ],
    })
  },
}
