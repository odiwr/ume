import { closeDb, getDb } from '@ume/db'
import { directDatabaseUrl } from '@ume/shared'

/** The bot is a long-lived process: always use the direct (non-pooled) URL when set. */
export const db = getDb(directDatabaseUrl())

export { closeDb }
export * from '@ume/db'
