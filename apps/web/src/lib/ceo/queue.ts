import 'server-only'
import { PgBoss } from 'pg-boss'
import { JOB_OPTIONS, directDatabaseUrl, type JobName, type JobPayloads } from '@ume/shared'

/**
 * Minimal pg-boss producer for the CEO console. Each call opens a short-lived
 * connection, ensures the queue exists, sends one job and closes. The worker owns
 * the queue lifecycle (schedules, supervision); the web app only ever sends.
 */
export async function enqueue<N extends JobName>(name: N, data: JobPayloads[N]): Promise<string | null> {
  const boss = new PgBoss({
    connectionString: directDatabaseUrl(),
    // The worker runs maintenance and cron; a request-scoped producer must not.
    supervise: false,
    schedule: false,
    max: 1,
  })
  boss.on('error', (err) => {
    console.error('[ceo/queue] pg-boss error', err)
  })
  await boss.start()
  try {
    try {
      await boss.createQueue(name)
    } catch {
      // Queue already exists (or the worker created it concurrently); sending still works.
    }
    return await boss.send(name, data, JOB_OPTIONS[name])
  } finally {
    await boss.stop({ graceful: false, close: true, timeout: 5_000 })
  }
}
