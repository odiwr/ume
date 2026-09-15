import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../client'
import { playlistTracks, playlists, tracks, workspaces } from '../schema'

/** Recompute denormalized counters for a playlist. */
export async function recountPlaylist(db: Db, playlistId: string): Promise<void> {
  const [agg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      duration: sql<number>`coalesce(sum(${tracks.durationMs}), 0)::bigint`,
    })
    .from(playlistTracks)
    .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .where(and(eq(playlistTracks.playlistId, playlistId), eq(tracks.status, 'ready')))
  await db
    .update(playlists)
    .set({ trackCount: agg?.count ?? 0, totalDurationMs: Number(agg?.duration ?? 0), updatedAt: new Date() })
    .where(eq(playlists.id, playlistId))
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

/** Ready tracks in a playlist, in position order, with who added them. */
export async function listPlaylistTracks(db: Db, playlistId: string) {
  return db.query.playlistTracks.findMany({
    where: eq(playlistTracks.playlistId, playlistId),
    orderBy: (bt, { asc }) => [asc(bt.position), asc(bt.addedAt)],
    with: {
      track: true,
      addedBy: { columns: { id: true, name: true, image: true, discordUsername: true, discordAvatar: true } },
    },
  })
}
