import { and, eq, lt, ne } from '../lib/orm'
import { JOBS } from '@ume/shared'
import { playlists, recomputeWorkspaceUsage, recountPlaylist, tracks, workspaces } from '@ume/db'
import { deleteTrackObjects } from '../lib/media'
import { defineJob } from './types'

const HOUR = 60 * 60 * 1000
const PENDING_MAX_AGE_MS = 24 * HOUR
const PROCESSING_MAX_AGE_MS = 6 * HOUR

/**
 * reconcile-storage (daily 04:15 UTC)
 * Re-derives every counter from the tracks table and clears out uploads that never finished.
 */
export const reconcileStorage = defineJob({
  name: JOBS.reconcileStorage,
  concurrency: 1,
  async run(ctx, job) {
    const log = ctx.log.child({ job: job.name, jobId: job.id })
    const db = ctx.db
    const storage = ctx.storage()
    const now = Date.now()

    const list = await db.query.workspaces.findMany({
      where: ne(workspaces.status, 'purged'),
      columns: { id: true },
    })
    const counts = {
      workspaces: list.length,
      playlists: 0,
      stalePendingDeleted: 0,
      staleProcessingFailed: 0,
      errors: 0,
    }

    for (const { id: workspaceId } of list) {
      try {
        // Uploads that never got a job (or whose job was lost) — drop them and free the original.
        const stalePending = await db.query.tracks.findMany({
          where: and(
            eq(tracks.workspaceId, workspaceId),
            eq(tracks.status, 'pending'),
            lt(tracks.updatedAt, new Date(now - PENDING_MAX_AGE_MS)),
          ),
        })
        for (const t of stalePending) {
          await deleteTrackObjects(storage, log, workspaceId, t.id, {
            outputs: true,
            original: t.originalStorageKey,
          })
          await db
            .delete(tracks)
            .where(and(eq(tracks.id, t.id), eq(tracks.workspaceId, workspaceId)))
          counts.stalePendingDeleted++
        }

        // Jobs that died mid-transcode — mark failed so the user can retry.
        const staleProcessing = await db.query.tracks.findMany({
          where: and(
            eq(tracks.workspaceId, workspaceId),
            eq(tracks.status, 'processing'),
            lt(tracks.updatedAt, new Date(now - PROCESSING_MAX_AGE_MS)),
          ),
        })
        for (const t of staleProcessing) {
          await deleteTrackObjects(storage, log, workspaceId, t.id, {
            outputs: true,
            original: t.originalStorageKey,
          })
          await db
            .update(tracks)
            .set({
              status: 'failed',
              errorMessage: 'Processing timed out. Please upload the file again.',
              sizeBytes: 0,
              storageKey: null,
              coverStorageKey: null,
              originalStorageKey: null,
              updatedAt: new Date(),
            })
            .where(and(eq(tracks.id, t.id), eq(tracks.workspaceId, workspaceId)))
          counts.staleProcessingFailed++
        }

        await recomputeWorkspaceUsage(db, workspaceId)
        const bs = await db
          .select({ id: playlists.id })
          .from(playlists)
          .where(eq(playlists.workspaceId, workspaceId))
        for (const b of bs) await recountPlaylist(db, b.id)
        counts.playlists += bs.length
      } catch (err) {
        counts.errors++
        log.error(
          { workspaceId, err: err instanceof Error ? err.message : String(err) },
          'reconcile failed for workspace',
        )
      }
    }
    log.info(counts, 'storage reconciled')
  },
})
