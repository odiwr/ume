import 'dotenv/config'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { closeDb, getDb } from './client'

const db = getDb()
await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname })
console.log('migrations applied')
await closeDb()
