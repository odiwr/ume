import { eq } from '../lib/orm'
import { JOBS } from '@ume/shared'
import {
  activityEvents,
  playlistTracks,
  playlists,
  claimTokens,
  dangerConfirmations,
  discordRoleMaps,
  invites,
  logAudit,
  memberships,
  tracks,
  workspaces,
  getFlag,
} from '@ume/db'
import { purgedEmail } from '@ume/email'
import { keys } from '@ume/storage'
import { notifyWorkspaceOwner } from '../lib/notify'
import { defineJob } from './types'

/**
 * purge-workspace {workspaceId, reason}
 * Deletes every object under the workspace prefix and every row except the audit log and
 * notification history, then leaves a `purged` tombstone. Safe to re-run.
 */
export const purgeWorkspace = defineJob({
  name: JOBS.purgeWorkspace,
  concurrency: 1,
  async run(ctx, job) {
    const { workspaceId, reason } = job.data
    const log = ctx.log.child({ job: job.name, jobId: job.id, workspaceId, reason })
    const db = ctx.db

    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
    if (!ws) return void log.warn('workspace not found; nothing to purge')
    if (ws.status === 'purged') return void log.info('already purged; no-op')

    if (ws.status !== 'purging') {
      const autoOk =
        reason === 'inactivity' &&
        (ws.status === 'connected' || ws.status === 'disconnected') &&
        (await getFlag(db, 'auto_purge_enabled'))
      if (!autoOk) {
        log.warn({ status: ws.status }, 'workspace is not in purging state; refusing to purge')
        return
      }
      await db
        .update(workspaces)
        .set({ status: 'purging', updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId))
    }

    // Storage first: if this throws we retry with rows intact and the workspace still "purging".
    const deleted = await ctx.storage().deletePrefix(keys.workspacePrefix(workspaceId))
    log.info({ objects: deleted }, 'storage prefix deleted')

    await db.transaction(async (tx) => {
      await tx.delete(playlistTracks).where(eq(playlistTracks.workspaceId, workspaceId))
      await tx.delete(tracks).where(eq(tracks.workspaceId, workspaceId))
      await tx.delete(playlists).where(eq(playlists.workspaceId, workspaceId))
      await tx.delete(memberships).where(eq(memberships.workspaceId, workspaceId))
      await tx.delete(invites).where(eq(invites.workspaceId, workspaceId))
      await tx.delete(discordRoleMaps).where(eq(discordRoleMaps.workspaceId, workspaceId))
      await tx.delete(claimTokens).where(eq(claimTokens.workspaceId, workspaceId))
      await tx.delete(dangerConfirmations).where(eq(dangerConfirmations.workspaceId, workspaceId))
      await tx.delete(activityEvents).where(eq(activityEvents.workspaceId, workspaceId))
      const now = new Date()
      await tx
        .update(workspaces)
        .set({
          status: 'purged',
          purgedAt: now,
          storageUsedBytes: 0,
          trackCount: 0,
          homeVoiceChannelId: null,
          botVoiceChannelId: null,
          inactivityNotice30dSentAt: null,
          inactivityNotice48hSentAt: null,
          updatedAt: now,
        })
        .where(eq(workspaces.id, workspaceId))
    })

    await logAudit(db, {
      workspaceId,
      actorUserId: job.data.requestedByUserId ?? null,
      actorDiscordId: job.data.requestedByDiscordId ?? null,
      action: 'workspace.purge',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { reason, objectsDeleted: deleted, guildId: ws.guildId, guildName: ws.guildName },
    })

    const emailReason = reason === 'inactivity' ? 'inactivity' : 'owner'
    const tpl = purgedEmail({ to: '', serverName: ws.guildName, reason: emailReason })
    const why =
      reason === 'inactivity'
        ? 'after 60 days without activity'
        : reason === 'ceo'
          ? 'by Ume support'
          : 'at the owner’s request'
    await notifyWorkspaceOwner(db, log, ws, {
      kind: 'purged',
      email: { subject: tpl.subject, html: tpl.html, text: tpl.text },
      discordText: `The Ume workspace for **${ws.guildName}** was permanently deleted ${why}. Playlists, music and members are gone. Run /reload in the server (or DM me \`~reload\`) to start fresh.`,
      metadata: { reason },
    })
    log.info('workspace purged')
  },
})
