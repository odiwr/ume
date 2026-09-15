import type { PgBoss, JobWithMetadata } from 'pg-boss'
import type { Logger } from 'pino'
import type { Db } from '@ume/db'
import type { Storage } from '@ume/storage'
import type { JobName, JobPayloads } from '@ume/shared'

export interface JobContext {
  db: Db
  /** Lazy: cron-only deployments do not need S3 credentials until a job touches storage. */
  storage: () => Storage
  boss: PgBoss
  log: Logger
}

export interface JobDefinition<N extends JobName = JobName> {
  name: N
  /** Per-process parallelism (pg-boss `localConcurrency`). Batch size is always 1. */
  concurrency: number
  run(ctx: JobContext, job: JobWithMetadata<JobPayloads[N]>): Promise<void>
}

export function defineJob<N extends JobName>(def: JobDefinition<N>): JobDefinition<N> {
  return def
}

/** True when pg-boss will run this job again after we throw. */
export function willRetry(job: JobWithMetadata<unknown>): boolean {
  return job.retryCount < job.retryLimit
}
