import { eq } from 'drizzle-orm'
import type { Db } from '../client'
import { featureFlags } from '../schema'

export const FLAG_DEFAULTS: Record<string, { enabled: boolean; description: string }> = {
  youtube_ingest: {
    enabled: false,
    description:
      'Allow adding YouTube links (~add / web). OFF by default: downloading YouTube audio violates YouTube ToS and is what got Groovy and Rythm shut down. Turn on only if you accept that risk.',
  },
  uploads_enabled: { enabled: true, description: 'Allow file uploads.' },
  signups_open: { enabled: true, description: 'Allow new accounts to be created.' },
  auto_purge_enabled: { enabled: true, description: 'Run the 60-day inactivity purge sweep.' },
  maintenance_banner: { enabled: false, description: 'Show a maintenance banner on the web app (value.message).' },
}

export async function getFlag(db: Db, key: string): Promise<boolean> {
  const row = await db.query.featureFlags.findFirst({ where: eq(featureFlags.key, key) })
  if (row) return row.enabled
  return FLAG_DEFAULTS[key]?.enabled ?? false
}

export async function getAllFlags(db: Db) {
  const rows = await db.query.featureFlags.findMany()
  const byKey = new Map(rows.map((r) => [r.key, r]))
  return Object.entries(FLAG_DEFAULTS).map(([key, def]) => {
    const row = byKey.get(key)
    return {
      key,
      enabled: row?.enabled ?? def.enabled,
      description: row?.description ?? def.description,
      value: row?.value ?? {},
      updatedAt: row?.updatedAt ?? null,
    }
  })
}

export async function setFlag(
  db: Db,
  key: string,
  patch: { enabled?: boolean; value?: Record<string, unknown> },
  updatedByUserId?: string | null,
): Promise<void> {
  const def = FLAG_DEFAULTS[key]
  await db
    .insert(featureFlags)
    .values({
      key,
      enabled: patch.enabled ?? def?.enabled ?? false,
      value: patch.value ?? {},
      description: def?.description ?? null,
      updatedByUserId: updatedByUserId ?? null,
    })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: {
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.value !== undefined ? { value: patch.value } : {}),
        updatedByUserId: updatedByUserId ?? null,
        updatedAt: new Date(),
      },
    })
}
