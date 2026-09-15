import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = PostgresJsDatabase<typeof schema>

let cached: { db: Db; sql: ReturnType<typeof postgres> } | null = null

/**
 * One connection pool per process. Web (Next.js) runs in a serverless-ish environment,
 * so keep `max` small there; the bot/worker can afford a few more.
 */
export function getDb(url = process.env.DATABASE_URL): Db {
  if (cached) return cached.db
  if (!url) throw new Error('DATABASE_URL is not set')
  const isServerless = !!process.env.VERCEL || process.env.DB_POOL_MODE === 'serverless'
  const sql = postgres(url, {
    max: isServerless ? 3 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // works with PgBouncer / Neon pooled connections
  })
  const db = drizzle(sql, { schema })
  cached = { db, sql }
  return db
}

export async function closeDb(): Promise<void> {
  if (!cached) return
  await cached.sql.end({ timeout: 5 })
  cached = null
}
