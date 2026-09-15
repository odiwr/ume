import type { JobDefinition } from './types'
import { transcodeUpload } from './transcode-upload'
import { extractLink } from './extract-link'
import { purgeWorkspace } from './purge-workspace'
import { inactivitySweep } from './inactivity-sweep'
import { reconcileStorage } from './reconcile-storage'
import { expireThings } from './expire-things'
import { sendEmailJob } from './send-email'

/** Every queue the worker serves. Order is irrelevant; each gets its own pg-boss worker. */
export const jobs: JobDefinition[] = [
  transcodeUpload,
  extractLink,
  purgeWorkspace,
  inactivitySweep,
  reconcileStorage,
  expireThings,
  sendEmailJob,
] as JobDefinition[]

/** Cron schedules (UTC). pg-boss stores them in the database; re-scheduling on boot is idempotent. */
export const schedules: Array<{ name: JobDefinition['name']; cron: string; description: string }> =
  [
    {
      name: inactivitySweep.name,
      cron: '15 3 * * *',
      description: 'daily 03:15 UTC — inactivity notices and purges',
    },
    {
      name: reconcileStorage.name,
      cron: '15 4 * * *',
      description: 'daily 04:15 UTC — recompute usage, clean stuck uploads',
    },
    {
      name: expireThings.name,
      cron: '0 * * * *',
      description: 'hourly — expire memberships and invites',
    },
  ]

export { YOUTUBE_TOS_WARNING } from './extract-link'
