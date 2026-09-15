import { and, eq, sql } from 'drizzle-orm'
import { slugify } from '@ume/shared'
import { playlists, db, type Playlist } from './db'

/** Find a playlist by slug or (case-insensitive) name inside one workspace. */
export async function findPlaylist(workspaceId: string, input: string): Promise<Playlist | undefined> {
  const raw = input.trim()
  if (!raw) return undefined
  const slug = slugify(raw)
  const lower = raw.toLowerCase()
  return db.query.playlists.findFirst({
    where: and(
      eq(playlists.workspaceId, workspaceId),
      sql`(${playlists.slug} = ${slug} or lower(${playlists.name}) = ${lower})`,
    ),
  })
}

export async function listPlaylists(workspaceId: string): Promise<Playlist[]> {
  return db.query.playlists.findMany({
    where: eq(playlists.workspaceId, workspaceId),
    orderBy: (b, { asc }) => [asc(b.position), asc(b.name)],
  })
}

/**
 * Per-guild cache of playlist names for slash-command autocomplete. Autocomplete
 * fires on every keystroke, so it must never hit Postgres each time.
 */
interface CacheEntry {
  at: number
  items: { name: string; slug: string }[]
}
const cache = new Map<string, CacheEntry>()
const TTL_MS = 60_000

export async function cachedPlaylistNames(guildId: string, workspaceId: string): Promise<{ name: string; slug: string }[]> {
  const hit = cache.get(guildId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.items
  const rows = await listPlaylists(workspaceId)
  const items = rows.map((b) => ({ name: b.name, slug: b.slug }))
  cache.set(guildId, { at: Date.now(), items })
  return items
}

export function invalidatePlaylistCache(guildId: string): void {
  cache.delete(guildId)
}
