import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { can, getAccess, touchActivity, tracks } from '@ume/db'
import { CAP, JOBS, UPLOAD } from '@ume/shared'
import { getStorage } from '@ume/storage'
import { db } from '@/lib/db'
import { enqueue } from '@/lib/queue'
import { getSession } from '@/lib/session'
import { failUpload } from '@/lib/app/upload'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  trackId: z.string().min(1),
  /** Set by the browser when the PUT itself failed; the track is marked failed and the reservation released. */
  error: z.string().max(300).optional(),
})

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status })
}

/**
 * Step 3 of an upload: confirm the object landed (size check via HEAD) and queue the
 * transcode. Anything short of that marks the track failed and releases the quota.
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.user.banned) return json(401, { error: 'Sign in to upload.' })
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json(400, { error: 'Invalid request.' })
  const { trackId, error } = parsed.data

  const track = await db.query.tracks.findFirst({ where: eq(tracks.id, trackId) })
  if (!track || track.source !== 'upload') return json(404, { error: 'Upload not found.' })
  const access = await getAccess(db, track.workspaceId, session.user.id)
  if (!access?.membership || !can(access, CAP.ADD_TRACK)) return json(404, { error: 'Upload not found.' })
  if (track.uploadedByUserId !== session.user.id) return json(403, { error: 'You can only finish your own uploads.' })
  if (track.status !== 'pending' || !track.originalStorageKey) return json(409, { error: 'This upload was already processed.' })

  if (error) {
    await failUpload(track.workspaceId, track.id, `Upload failed in the browser: ${error}`)
    return json(200, { ok: true, status: 'failed' })
  }

  const head = await getStorage()
    .head(track.originalStorageKey)
    .catch(() => null)
  if (!head) {
    await failUpload(track.workspaceId, track.id, 'The file never arrived in storage.')
    return json(409, { error: 'The file never arrived in storage. Try uploading it again.' })
  }
  if (head.size > UPLOAD.maxOriginalBytes || (track.originalSizeBytes !== null && head.size !== track.originalSizeBytes)) {
    await failUpload(track.workspaceId, track.id, 'The stored file did not match what was announced.')
    await getStorage()
      .deleteObject(track.originalStorageKey)
      .catch(() => undefined)
    return json(409, { error: 'The uploaded file did not match its declared size. Try again.' })
  }

  try {
    await enqueue(JOBS.transcodeUpload, { trackId: track.id, workspaceId: track.workspaceId })
  } catch (err) {
    console.error('[upload/complete] enqueue failed', err)
    await failUpload(track.workspaceId, track.id, 'Could not queue the transcode.')
    return json(500, { error: 'Could not queue the transcode. Try again in a moment.' })
  }
  await touchActivity(db, track.workspaceId, {
    kind: 'web_action',
    userId: session.user.id,
    metadata: { action: 'track.upload', trackId: track.id, bytes: head.size },
  })
  await db
    .update(tracks)
    .set({ updatedAt: new Date() })
    .where(and(eq(tracks.id, track.id), eq(tracks.workspaceId, track.workspaceId)))
  return json(200, { ok: true, status: 'pending' })
}
