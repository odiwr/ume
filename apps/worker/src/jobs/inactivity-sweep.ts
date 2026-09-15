import { and, eq, inArray, lte } from '../lib/orm'
import { INACTIVITY, JOBS, JOB_OPTIONS, isPaidPlan } from '@ume/shared'
import { getFlag, workspaces } from '@ume/db'
import { inactivity30dEmail, inactivity48hEmail } from '@ume/email'
import { dashboardUrl } from '../lib/env'
import { notifyWorkspaceOwner } from '../lib/notify'
import { defineJob } from './types'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/**
 * inactivity-sweep (daily 03:15 UTC)
 * Free workspaces idle 30 days get a notice, 48 h before the deadline a final notice,
 * and at INACTIVITY.purgeAfterDays a purge job. Paid plans are exempt. Any activity
 * (touchActivity) clears the notice stamps, so the cycle restarts cleanly.
 */
export const inactivitySweep = defineJob({
  name: JOBS.inactivitySweep,
  concurrency: 1,
  async run(ctx, job) {
    const log = ctx.log.child({ job: job.name, jobId: job.id })
    const db = ctx.db
    if (!(await getFlag(db, 'auto_purge_enabled'))) return void log.info('auto_purge_enabled is off; sweep skipped')

    const now = Date.now()
    const firstNoticeCutoff = new Date(now - INACTIVITY.firstNoticeAtDays * DAY)
    const candidates = await db.query.workspaces.findMany({
      where: and(inArray(workspaces.status, ['connected', 'disconnected']), lte(workspaces.lastActivityAt, firstNoticeCutoff)),
    })

    const counts = { scanned: candidates.length, exemptPaid: 0, notice30d: 0, notice48h: 0, purged: 0, errors: 0 }
    for (const ws of candidates) {
      if (isPaidPlan(ws.plan)) {
        counts.exemptPaid++
        continue
      }
      const wlog = log.child({ workspaceId: ws.id, guild: ws.guildName })
      try {
        const purgeAt = new Date(ws.lastActivityAt.getTime() + INACTIVITY.purgeAfterDays * DAY)
        const finalNoticeAt = new Date(purgeAt.getTime() - INACTIVITY.finalNoticeHoursBefore * HOUR)
        const link = dashboardUrl(ws.umeId)

        if (now >= purgeAt.getTime()) {
          await db.update(workspaces).set({ status: 'purging', updatedAt: new Date() }).where(eq(workspaces.id, ws.id))
          await ctx.boss.send(JOBS.purgeWorkspace, { workspaceId: ws.id, reason: 'inactivity' }, {
            ...JOB_OPTIONS[JOBS.purgeWorkspace],
            singletonKey: `purge:${ws.id}`,
          })
          counts.purged++
          wlog.info({ purgeAt }, 'purge enqueued')
          continue
        }

        if (!ws.inactivityNotice30dSentAt) {
          const tpl = inactivity30dEmail({ to: '', serverName: ws.guildName, purgeAt, dashboardUrl: link })
          await notifyWorkspaceOwner(db, wlog, ws, {
            kind: 'inactivity_30d',
            email: { subject: tpl.subject, html: tpl.html, text: tpl.text },
            discordText:
              `Ume on **${ws.guildName}** has been quiet for ${INACTIVITY.firstNoticeAtDays} days. ` +
              `If nobody joins my channel or runs a command, the workspace (playlists, music, members) will be permanently deleted on ${purgeAt.toUTCString()}.\n` +
              `Dashboard: ${link}`,
            metadata: { purgeAt: purgeAt.toISOString() },
          })
          await db.update(workspaces).set({ inactivityNotice30dSentAt: new Date(), updatedAt: new Date() }).where(eq(workspaces.id, ws.id))
          counts.notice30d++
          wlog.info({ purgeAt }, '30-day notice sent')
        }

        if (now >= finalNoticeAt.getTime() && !ws.inactivityNotice48hSentAt) {
          const tpl = inactivity48hEmail({ to: '', serverName: ws.guildName, purgeAt, dashboardUrl: link })
          await notifyWorkspaceOwner(db, wlog, ws, {
            kind: 'inactivity_48h',
            email: { subject: tpl.subject, html: tpl.html, text: tpl.text },
            discordText:
              `Final notice: the Ume workspace for **${ws.guildName}** will be permanently deleted on ${purgeAt.toUTCString()} ` +
              `unless someone joins my channel or runs a command before then.\nKeep it: ${link}`,
            metadata: { purgeAt: purgeAt.toISOString() },
          })
          await db.update(workspaces).set({ inactivityNotice48hSentAt: new Date(), updatedAt: new Date() }).where(eq(workspaces.id, ws.id))
          counts.notice48h++
          wlog.info({ purgeAt }, '48-hour notice sent')
        }
      } catch (err) {
        counts.errors++
        wlog.error({ err: err instanceof Error ? err.message : String(err) }, 'sweep failed for workspace')
      }
    }
    log.info(counts, 'inactivity sweep done')
  },
})
