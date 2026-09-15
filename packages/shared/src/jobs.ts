/**
 * Background job contract shared by web (enqueues), bot (enqueues) and worker (runs).
 * Queue: pg-boss on the main Postgres. Job names are queue names.
 */
export const JOBS = {
  /** Transcode an uploaded original to normalized Opus, extract metadata, delete the original. */
  transcodeUpload: 'transcode-upload',
  /** Fetch audio for a linked YouTube track (only when the youtube_ingest flag is on). */
  ingestYouTube: 'ingest-youtube',
  /** Delete a workspace's storage prefix and rows. */
  purgeWorkspace: 'purge-workspace',
  /** Daily: 30-day / 48-hour inactivity notices and 60-day purges. */
  inactivitySweep: 'inactivity-sweep',
  /** Daily: recompute storage_used_bytes from tracks and delete orphaned objects. */
  reconcileStorage: 'reconcile-storage',
  /** Hourly: expire claim tokens, invites and temporary memberships. */
  expireThings: 'expire-things',
  /** Send a transactional email (retry-safe). */
  sendEmail: 'send-email',
} as const

export type JobName = (typeof JOBS)[keyof typeof JOBS]

export interface TranscodeUploadJob {
  trackId: string
  workspaceId: string
}

export interface IngestYouTubeJob {
  trackId: string
  workspaceId: string
  youtubeId: string
  requestedByUserId?: string | null
  requestedByDiscordId?: string | null
}

export interface PurgeWorkspaceJob {
  workspaceId: string
  reason: 'owner' | 'inactivity' | 'ceo'
  requestedByUserId?: string | null
  requestedByDiscordId?: string | null
}

export interface SendEmailJob {
  to: string
  subject: string
  html: string
  text: string
  kind: 'invite' | 'inactivity_30d' | 'inactivity_48h' | 'purged' | 'token_rotated' | 'quota_warning' | 'other'
  workspaceId?: string | null
  userId?: string | null
}

export interface JobPayloads {
  [JOBS.transcodeUpload]: TranscodeUploadJob
  [JOBS.ingestYouTube]: IngestYouTubeJob
  [JOBS.purgeWorkspace]: PurgeWorkspaceJob
  [JOBS.inactivitySweep]: Record<string, never>
  [JOBS.reconcileStorage]: Record<string, never>
  [JOBS.expireThings]: Record<string, never>
  [JOBS.sendEmail]: SendEmailJob
}

/** Retry policy per queue (pg-boss `send` options). */
export const JOB_OPTIONS: Record<JobName, { retryLimit: number; retryDelay: number; retryBackoff: boolean; expireInSeconds: number }> = {
  [JOBS.transcodeUpload]: { retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 15 * 60 },
  [JOBS.ingestYouTube]: { retryLimit: 2, retryDelay: 60, retryBackoff: true, expireInSeconds: 15 * 60 },
  [JOBS.purgeWorkspace]: { retryLimit: 5, retryDelay: 60, retryBackoff: true, expireInSeconds: 30 * 60 },
  [JOBS.inactivitySweep]: { retryLimit: 1, retryDelay: 300, retryBackoff: false, expireInSeconds: 30 * 60 },
  [JOBS.reconcileStorage]: { retryLimit: 1, retryDelay: 300, retryBackoff: false, expireInSeconds: 60 * 60 },
  [JOBS.expireThings]: { retryLimit: 1, retryDelay: 300, retryBackoff: false, expireInSeconds: 10 * 60 },
  [JOBS.sendEmail]: { retryLimit: 5, retryDelay: 30, retryBackoff: true, expireInSeconds: 5 * 60 },
}

/** Postgres URL for long-lived processes (bot/worker); falls back to the pooled URL. */
export function directDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL_DIRECT || env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return url
}
