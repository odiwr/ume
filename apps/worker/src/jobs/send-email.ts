import { JOBS } from '@ume/shared'
import { notifications } from '@ume/db'
import { sendEmail } from '@ume/email'
import { RetryableError } from '../lib/errors'
import { newNotificationId, type NotificationKind } from '../lib/notify'
import { defineJob } from './types'

const RECORDED_KINDS = new Set<string>(['invite', 'inactivity_30d', 'inactivity_48h', 'purged', 'token_rotated', 'quota_warning'])

/**
 * send-email {to, subject, html, text, kind, workspaceId?, userId?}
 * Retry-safe transactional email. Failures throw so pg-boss retries with backoff.
 */
export const sendEmailJob = defineJob({
  name: JOBS.sendEmail,
  concurrency: 1,
  async run(ctx, job) {
    const { to, subject, html, text, kind, workspaceId, userId } = job.data
    const log = ctx.log.child({ job: job.name, jobId: job.id, kind, to })
    const res = await sendEmail({ to, subject, html, text })
    if (RECORDED_KINDS.has(kind)) {
      await ctx.db
        .insert(notifications)
        .values({
          id: newNotificationId(),
          workspaceId: workspaceId ?? null,
          userId: userId ?? null,
          kind: kind as NotificationKind,
          channel: 'email',
          recipient: to,
          status: res.ok ? 'sent' : 'failed',
          error: res.ok ? null : (res.error ?? 'send failed'),
          metadata: { subject, jobId: job.id, attempt: job.retryCount },
        })
        .catch(() => undefined)
    }
    if (!res.ok) throw new RetryableError(`email to ${to} failed: ${res.error ?? 'unknown'}`)
    log.info({ id: res.id }, 'email sent')
  },
})
