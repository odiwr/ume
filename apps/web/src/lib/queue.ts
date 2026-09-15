import 'server-only'
import { PgBoss } from 'pg-boss'
import { JOB_OPTIONS, directDatabaseUrl, type JobName, type JobPayloads } from '@ume/shared'

/**
 * Lazy pg-boss singleton for the web app. The web only *sends* jobs; the worker
 * owns scheduling and maintenance, so both are disabled here. pg-boss v12 requires
 * a queue to exist before `send`, so every queue is created (idempotently) on first use.
 */
let bossPromise: Promise<PgBoss> | null = null
const ensuredQueues = new Set<string>()

async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({
        connectionString: directDatabaseUrl(),
        schedule: false,
        supervise: false,
        application_name: 'ume-web',
      })
      boss.on('error', (err) => console.error('[pg-boss]', err))
      await boss.start()
      return boss
    })().catch((err) => {
      bossPromise = null
      throw err
    })
  }
  return bossPromise
}

async function ensureQueue(boss: PgBoss, name: JobName): Promise<void> {
  if (ensuredQueues.has(name)) return
  const opts = JOB_OPTIONS[name]
  await boss.createQueue(name, {
    retryLimit: opts.retryLimit,
    retryDelay: opts.retryDelay,
    retryBackoff: opts.retryBackoff,
    expireInSeconds: opts.expireInSeconds,
  })
  ensuredQueues.add(name)
}

/** Enqueue a job with the retry policy from JOB_OPTIONS. Returns the job id. */
export async function enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<string | null> {
  const boss = await getBoss()
  await ensureQueue(boss, name)
  const opts = JOB_OPTIONS[name]
  return boss.send(name, payload as object, {
    retryLimit: opts.retryLimit,
    retryDelay: opts.retryDelay,
    retryBackoff: opts.retryBackoff,
    expireInSeconds: opts.expireInSeconds,
  })
}
