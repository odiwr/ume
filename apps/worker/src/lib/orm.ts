import { getDb, type Db } from '@ume/db'
import { directDatabaseUrl } from '@ume/shared'

/**
 * Drizzle query operators (eq, and, sql, ...) without a direct `drizzle-orm` dependency.
 *
 * The worker's package.json deliberately depends only on the workspace packages, and pnpm
 * keeps `drizzle-orm` private to @ume/db. Drizzle hands the very same operator set to every
 * relational `where` callback, and building a query's SQL (`toSQL()`) runs that callback
 * without touching the database — so we capture it once at import time.
 *
 * If `drizzle-orm` is ever added to apps/worker (or re-exported from @ume/db), replace the
 * body of this file with `export { eq, and, ... } from 'drizzle-orm'`; nothing else changes.
 */
type FindFirstArg = NonNullable<Parameters<Db['query']['featureFlags']['findFirst']>[0]>
type WhereFn = Extract<NonNullable<FindFirstArg['where']>, (...args: never[]) => unknown>
export type Operators = Parameters<WhereFn>[1]

function capture(): Operators {
  const db = getDb(directDatabaseUrl())
  let ops: Operators | undefined
  db.query.featureFlags
    .findFirst({
      where: (_cols, operators) => {
        ops = operators
        return undefined
      },
    })
    .toSQL()
  if (!ops) throw new Error('could not capture drizzle operators')
  return ops
}

const ops = capture()

export const { and, between, eq, exists, gt, gte, ilike, inArray, isNull, isNotNull, like, lt, lte, ne, not, notInArray, or, sql } = ops
