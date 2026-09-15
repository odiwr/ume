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

async function main(): Promise<void> {
  const log = createLogger()
  const dbUrl = directDatabaseUrl()
  const db = getDb(dbUrl)

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
  log.info({ schema: 'pgboss', ffmpeg: env.ffmpegPath, ytdlp: env.ytdlpPath, appUrl: env.appUrl }, 'pg-boss started')

  // Queues carry the retry policy; jobs inherit it unless `send` overrides.
  for (const name of Object.values(JOBS) as JobName[]) {
    try {
      await boss.createQueue(name, JOB_OPTIONS[name])
    } catch (err) {
      if (!/already exists|duplicate key/i.test(describeError(err))) throw err
    }
  }

  // Workers: batch size 1 so one job maps to one handler call; concurrency per queue.
  for (const def of jobs) {
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
            log.error({ job: def.name, jobId: job.id, attempt: job.retryCount, of: job.retryLimit, ms: Date.now() - started, err: describeError(err) }, 'job failed')
            throw err
          }
        }
      },
    )
    log.info({ queue: def.name, concurrency: def.concurrency }, 'worker registered')
  }

  // Crons (UTC). Stored in the database; safe to re-run on every boot.
  for (const s of schedules) {
    await boss.schedule(s.name, s.cron, {}, { ...JOB_OPTIONS[s.name], tz: 'UTC' })
    log.info({ queue: s.name, cron: s.cron }, s.description)
  }

  if (await getFlag(db, 'link_extract').catch(() => false)) log.warn(YOUTUBE_TOS_WARNING)

  const heartbeat = setInterval(() => {
    const mem = process.memoryUsage()
    log.info({ rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576), uptimeS: Math.round(process.uptime()) }, 'heartbeat')
  }, HEARTBEAT_MS)
  heartbeat.unref()

  let stopping = false
  const shutdown = async (signal: string) => {
    if (stopping) return
    stopping = true
    log.info({ signal }, 'shutting down: waiting for active jobs')
    clearInterval(heartbeat)
    try {
      await boss.stop({ graceful: true, timeout: 5 * 60 * 1000 })
      await new Promise<void>((resolve) => {
        boss.once('stopped', () => resolve())
        setTimeout(resolve, 5 * 60 * 1000 + 5_000).unref()
      })
    } catch (err) {
      log.error({ err: describeError(err) }, 'pg-boss stop failed')
    }
    await closeDb().catch(() => undefined)
    log.info('bye')
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) => log.error({ err: describeError(reason) }, 'unhandled rejection'))
  process.on('uncaughtException', (err) => {
    log.fatal({ err: describeError(err) }, 'uncaught exception')
    void shutdown('uncaughtException')
  })

  log.info({ queues: jobs.map((j) => j.name) }, 'ume worker ready')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
