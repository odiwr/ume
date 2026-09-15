import { and, isNull, lt } from '../lib/orm'
import { JOBS } from '@ume/shared'
import { invites, memberships } from '@ume/db'
import { defineJob } from './types'

/**
 * expire-things (hourly)
 * Temporary memberships past their expiry are removed; invites past their expiry are
 * revoked. Claim tokens are validated at claim time, so nothing else is touched.
 */
export const expireThings = defineJob({
  name: JOBS.expireThings,
  concurrency: 1,
  async run(ctx, job) {
    const log = ctx.log.child({ job: job.name, jobId: job.id })
    const now = new Date()
    const removed = await ctx.db.delete(memberships).where(lt(memberships.expiresAt, now)).returning({ id: memberships.id })
    const revoked = await ctx.db
      .update(invites)
      .set({ revokedAt: now })
      .where(and(lt(invites.expiresAt, now), isNull(invites.revokedAt)))
      .returning({ id: invites.id })
    log.info({ membershipsRemoved: removed.length, invitesRevoked: revoked.length }, 'expiry pass done')
  },
})
