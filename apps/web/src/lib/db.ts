import 'server-only'
import { getDb } from '@ume/db'

export const db = getDb()
export * from '@ume/db'
