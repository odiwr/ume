import { PgBoss, type JobWithMetadata } from 'pg-boss'
import { JOBS, JOB_OPTIONS, directDatabaseUrl, type JobName } from '@ume/shared'
import { closeDb, getDb, getFlag } from '@ume/db'
import { getStorage, type Storage } from '@ume/storage'
import { createLogger } from './lib/logger'
import { env } from './lib/env'
import { describeError } from './lib/errors'
import { jobs, schedules, YOUTUBE_TOS_WARNING } from './jobs'
import type { JobContext } from './jobs/types'

const HEARTBEAT_MS = 60_000
const SHUTDOWN_TIMEOUT_MS = 5 * 60 * 1000

/**
 * WORKER_QUEUES picks the queues this instance consumes. Empty = all of them. A second
 * instance on a residential connection typically runs `WORKER_QUEUES=extract-link` only.
 */
function selectQueues(log: ReturnType<typeof createLogger>): Set<JobName> {
  const all = new Set<JobName>(Object.values(JOBS) as JobName[])
  if (env.workerQueues.length === 0) return all
  const chosen = new Set<JobName>()
  for (const q of env.workerQueues) {
    if (all.has(q as JobName)) chosen.add(q as JobName)
    else
      log.warn({ queue: q, known: [...all] }, 'WORKER_QUEUES names an unknown queue; ignoring it')
  }
  if (chosen.size === 0) {
    log.warn('WORKER_QUEUES matched nothing; this instance will consume every queue')
    return all
  }
  return chosen
}

async function main(): Promise<void> {
  const log = createLogger()
  const dbUrl = directDatabaseUrl()
  const db = getDb(dbUrl)
  const consumed = selectQueues(log)

  let storage: Storage | null = null
  const ctx: JobContext = {
    db,
    storage: () => (storage ??= getStorage()),
    boss: new PgBoss({ connectionString: dbUrl, schema: 'pgboss', application_name: 'ume-worker' }),
    log,
  }
  const boss = ctx.boss
  boss.on('error', (err) => log.error({ err: describeError(err) }, 'pg-boss error'))

  await boss.start()
  log.info(
    {
      schema: 'pgboss',
      queues: [...consumed],
      extractor: env.extractorProvider,
      ffmpeg: env.ffmpegPath,
      ytdlp: env.extractorProvider === 'ytdlp' ? env.ytdlpPath : undefined,
      cobalt:
        env.extractorProvider === 'cobalt'
          ? env.cobaltApiUrl || '(COBALT_API_URL missing)'
          : undefined,
      appUrl: env.appUrl,
    },
    'pg-boss started',
  )

  // Every queue exists with its retry policy, whichever instance boots first. Idempotent.
  for (const name of Object.values(JOBS) as JobName[]) {
    try {
      await boss.createQueue(name, JOB_OPTIONS[name])
    } catch (err) {
      if (!/already exists|duplicate key/i.test(describeError(err))) throw err
    }
  }

  // Workers: batch size 1 so one job maps to one handler call; concurrency per queue.
  const active = jobs.filter((def) => consumed.has(def.name))
  for (const def of active) {
    await boss.work(
      def.name,
      { batchSize: 1, localConcurrency: def.concurrency, includeMetadata: true },
      async (batch: JobWithMetadata<object>[]) => {
        for (const job of batch) {
          const started = Date.now()
          try {
            await def.run(ctx, job as never)
            log.debug({ job: def.name, jobId: job.id, ms: Date.now() - started }, 'job completed')
          } catch (err) {
            log.error(
              {
                job: def.name,
                jobId: job.id,
                attempt: job.retryCount,
                of: job.retryLimit,
                ms: Date.now() - started,
                err: describeError(err),
              },
              'job failed',
            )
            throw err
          }
        }
      },
    )
    log.info({ queue: def.name, concurrency: def.concurrency }, 'worker registered')
  }

  // Crons (UTC) only for queues this instance consumes; pg-boss stores them, so re-scheduling is idempotent.
  for (const s of schedules) {
    if (!consumed.has(s.name)) continue
    await boss.schedule(s.name, s.cron, {}, { ...JOB_OPTIONS[s.name], tz: 'UTC' })
    log.info({ queue: s.name, cron: s.cron }, s.description)
  }

  if (await getFlag(db, 'link_extract').catch(() => false)) {
    log.warn(
      { provider: env.extractorProvider, consumesExtractLink: consumed.has(JOBS.extractLink) },
      YOUTUBE_TOS_WARNING,
    )
  } else {
    log.info('link_extract flag is off: links are stored as metadata-only entries')
  }
  if (consumed.has(JOBS.extractLink) && env.extractorProvider === 'cobalt' && !env.cobaltApiUrl) {
    log.error(
      'EXTRACTOR_PROVIDER=cobalt but COBALT_API_URL is empty; every extract-link job will retry and fail',
    )
  }

  const heartbeat = setInterval(() => {
    const mem = process.memoryUsage()
    log.info(
      {
        rssMb: Math.round(mem.rss / 1048576),
        heapMb: Math.round(mem.heapUsed / 1048576),
        uptimeS: Math.round(process.uptime()),
        queues: active.length,
      },
      'heartbeat',
    )
  }, HEARTBEAT_MS)
  heartbeat.unref()

  let stopping = false
  const shutdown = async (signal: string, code = 0) => {
    if (stopping) return
    stopping = true
    log.info({ signal }, 'shutting down: waiting for active jobs')
    clearInterval(heartbeat)
    try {
      const stopped = new Promise<void>((resolve) => {
        boss.once('stopped', () => resolve())
        setTimeout(resolve, SHUTDOWN_TIMEOUT_MS + 5_000).unref()
      })
      await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS })
      await stopped
    } catch (err) {
      log.error({ err: describeError(err) }, 'pg-boss stop failed')
    }
    await closeDb().catch(() => undefined)
    log.info('bye')
    process.exit(code)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) =>
    log.error({ err: describeError(reason) }, 'unhandled rejection'),
  )
  process.on('uncaughtException', (err) => {
    log.fatal({ err: describeError(err) }, 'uncaught exception')
    void shutdown('uncaughtException', 1)
  })

  log.info({ queues: active.map((j) => j.name) }, 'ume worker ready')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
