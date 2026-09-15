import { PgBoss } from 'pg-boss'
import { JOBS, JOB_OPTIONS, directDatabaseUrl, type JobName, type JobPayloads } from '@ume/shared'
import { logger } from './logger'

/**
 * Enqueue-only pg-boss client. The worker owns queue consumption; the bot only
 * needs `send`. pg-boss 12 requires `createQueue` before the first `send`, so
 * queues are created lazily and idempotently on first use.
 */
let boss: PgBoss | null = null
let starting: Promise<PgBoss> | null = null
const createdQueues = new Set<string>()

async function getBoss(): Promise<PgBoss> {
  if (boss) return boss
  if (!starting) {
    starting = (async () => {
      const b = new PgBoss({ connectionString: directDatabaseUrl(), max: 2 })
      b.on('error', (err) => logger.error({ err }, 'pg-boss error'))
      await b.start()
      boss = b
      return b
    })().catch((err) => {
      starting = null
      throw err
    })
  }
  return starting
}

async function ensureQueue(b: PgBoss, name: JobName): Promise<void> {
  if (createdQueues.has(name)) return
  const opts = JOB_OPTIONS[name]
  try {
    await b.createQueue(name, {
      retryLimit: opts.retryLimit,
      retryDelay: opts.retryDelay,
      retryBackoff: opts.retryBackoff,
      expireInSeconds: opts.expireInSeconds,
    })
  } catch (err) {
    // Another process (web/worker) may have created it concurrently; `send` will tell us if it truly failed.
    logger.debug({ err, queue: name }, 'createQueue raised (probably already exists)')
  }
  createdQueues.add(name)
}

export async function enqueue<N extends JobName>(
  name: N,
  payload: JobPayloads[N],
  options: { singletonKey?: string } = {},
): Promise<string | null> {
  const b = await getBoss()
  await ensureQueue(b, name)
  const opts = JOB_OPTIONS[name]
  return b.send(name, payload as object, {
    retryLimit: opts.retryLimit,
    retryDelay: opts.retryDelay,
    retryBackoff: opts.retryBackoff,
    expireInSeconds: opts.expireInSeconds,
    ...(options.singletonKey ? { singletonKey: options.singletonKey } : {}),
  })
}

export async function stopQueue(): Promise<void> {
  if (!boss) return
  const b = boss
  boss = null
  starting = null
  try {
    await b.stop({ graceful: false, timeout: 3_000 })
  } catch (err) {
    logger.warn({ err }, 'pg-boss stop failed')
  }
}

export { JOBS }
