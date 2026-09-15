import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../client'
import { bucketTracks, buckets, tracks, workspaces } from '../schema'

/** Recompute denormalized counters for a bucket. */
export async function recountBucket(db: Db, bucketId: string): Promise<void> {
  const [agg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      duration: sql<number>`coalesce(sum(${tracks.durationMs}), 0)::bigint`,
    })
    .from(bucketTracks)
    .innerJoin(tracks, eq(tracks.id, bucketTracks.trackId))
    .where(and(eq(bucketTracks.bucketId, bucketId), eq(tracks.status, 'ready')))
  await db
    .update(buckets)
    .set({ trackCount: agg?.count ?? 0, totalDurationMs: Number(agg?.duration ?? 0), updatedAt: new Date() })
    .where(eq(buckets.id, bucketId))
}

/** Recompute storage usage and track count for a workspace from the tracks table. */
export async function recomputeWorkspaceUsage(db: Db, workspaceId: string): Promise<{ bytes: number; tracks: number }> {
  const [agg] = await db
    .select({
      bytes: sql<number>`coalesce(sum(${tracks.sizeBytes}), 0)::bigint`,
      count: sql<number>`count(*) filter (where ${tracks.status} <> 'failed')::int`,
    })
    .from(tracks)
    .where(eq(tracks.workspaceId, workspaceId))
  const bytes = Number(agg?.bytes ?? 0)
  const count = agg?.count ?? 0
  await db
    .update(workspaces)
    .set({ storageUsedBytes: bytes, trackCount: count, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
  return { bytes, tracks: count }
}

/** Ready tracks in a bucket, in position order, with who added them. */
export async function listBucketTracks(db: Db, bucketId: string) {
  return db.query.bucketTracks.findMany({
    where: eq(bucketTracks.bucketId, bucketId),
    orderBy: (bt, { asc }) => [asc(bt.position), asc(bt.addedAt)],
    with: {
      track: true,
      addedBy: { columns: { id: true, name: true, image: true, discordUsername: true, discordAvatar: true } },
    },
  })
}
