import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { closeDb, getDb } from './client'

const db = getDb()
// fileURLToPath, not URL.pathname: pathname keeps %20 for spaces and a leading slash on Windows.
await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
console.log('migrations applied')
await closeDb()
