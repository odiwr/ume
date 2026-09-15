import 'server-only'
import { and, eq, notExists, sql } from 'drizzle-orm'
import { playlistTracks, recomputeWorkspaceUsage, tracks } from '@ume/db'
import { getStorage } from '@ume/storage'
import { db } from '@/lib/db'

/**
 * Library helpers that must NOT be server actions (this file is server-only, not
 * 'use server', so nothing here is callable from the client).
 */

/** Delete tracks that are no longer in any playlist, along with their stored objects. */
export async function deleteOrphanTracks(workspaceId: string): Promise<number> {
  const orphans = await db
    .select({
      id: tracks.id,
      storageKey: tracks.storageKey,
      originalStorageKey: tracks.originalStorageKey,
      coverStorageKey: tracks.coverStorageKey,
    })
    .from(tracks)
    .where(
      and(
        eq(tracks.workspaceId, workspaceId),
        notExists(db.select({ one: sql`1` }).from(playlistTracks).where(eq(playlistTracks.trackId, tracks.id))),
      ),
    )
  if (!orphans.length) return 0
  const keys = orphans.flatMap((t) => [t.storageKey, t.originalStorageKey, t.coverStorageKey]).filter((k): k is string => !!k)
  if (keys.length) {
    try {
      await getStorage().deleteObjects(keys)
    } catch (err) {
      // The daily reconcile job removes anything we could not delete now.
      console.error('[storage] delete failed', err)
    }
  }
  for (const t of orphans) await db.delete(tracks).where(and(eq(tracks.id, t.id), eq(tracks.workspaceId, workspaceId)))
  await recomputeWorkspaceUsage(db, workspaceId)
  return orphans.length
}

