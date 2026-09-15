import path from 'node:path'
import { JOBS } from '@ume/shared'
import { describeError, isRetryable, userMessageOf } from '../lib/errors'
import {
  downloadToFile,
  failTrack,
  loadTrack,
  processLocalAudio,
  setProcessing,
} from '../lib/media'
import { withTempDir } from '../lib/tmp'
import { defineJob, willRetry } from './types'
import { eq } from '../lib/orm'
import { workspaces } from '@ume/db'

/**
 * transcode-upload {trackId, workspaceId}
 * Original object -> validated -> normalized Opus + cover -> original deleted.
 */
export const transcodeUpload = defineJob({
  name: JOBS.transcodeUpload,
  concurrency: 2,
  async run(ctx, job) {
    const { trackId, workspaceId } = job.data
    const log = ctx.log.child({ job: job.name, jobId: job.id, trackId, workspaceId })
    const db = ctx.db

    const track = await loadTrack(db, workspaceId, trackId)
    if (!track) return void log.warn('track not found; skipping')
    if (track.source !== 'upload')
      return void log.warn({ source: track.source }, 'not an upload; skipping')
    if (track.status !== 'pending' && track.status !== 'processing') {
      return void log.info({ status: track.status }, 'track is not pending; skipping')
    }
    if (!track.originalStorageKey) {
      await failTrack(db, ctx.storage(), log, track, {
        userMessage: 'The uploaded file was not found. Please upload it again.',
        willRetry: false,
      })
      return
    }
    const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
    if (!workspace || workspace.status === 'purged' || workspace.status === 'purging') {
      return void log.warn({ status: workspace?.status }, 'workspace unavailable; skipping')
    }

    await setProcessing(db, track)
    const storage = ctx.storage()

    try {
      await withTempDir(`upload-${trackId}`, async (tmpDir) => {
        const ext = path.extname(track.originalFilename ?? '') || '.bin'
        const inputPath = path.join(tmpDir, `source${ext}`)
        const bytes = await downloadToFile(storage, track.originalStorageKey!, inputPath)
        log.info({ bytes }, 'original downloaded')
        const outcome = await processLocalAudio({
          db,
          storage,
          log,
          workspace,
          track,
          inputPath,
          tmpDir,
        })
        log.info(outcome, 'upload processed')
      })
    } catch (err) {
      const retryable = isRetryable(err)
      const retrying = retryable && willRetry(job)
      log[retryable ? 'warn' : 'info'](
        { err: describeError(err), retrying },
        'upload processing failed',
      )
      await failTrack(db, storage, log, track, {
        userMessage: retrying
          ? 'Temporary problem while processing. Retrying shortly.'
          : userMessageOf(err),
        willRetry: retrying,
      })
      if (retryable) throw err
    }
  },
})
