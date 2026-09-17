import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { can, effectiveQuotaBytes, getAccess, getFlag, playlists } from '@ume/db'
import { CAP } from '@ume/shared'
import { getStorage, keys } from '@ume/storage'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { COVER_MAX_BYTES, COVER_TYPES } from '@/components/app/library/playlist-cover-rules'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  workspaceId: z.string().min(1).max(64),
  playlistId: z.string().min(1).max(64),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'Use a JPEG, PNG or WebP image.',
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(COVER_MAX_BYTES, { message: 'Cover images can be at most 5 MB.' }),
})

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status })
}

/**
 * Step 1 of a playlist cover upload: authorize, then hand the browser a presigned PUT
 * for a fresh versioned key. The `setPlaylistCover` server action finishes the job.
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.user.banned) return json(401, { error: 'Sign in to change the cover.' })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return json(400, { error: parsed.error.issues[0]?.message ?? 'Invalid cover upload.' })
  }
  const { workspaceId, playlistId, contentType, sizeBytes } = parsed.data

  const access = await getAccess(db, workspaceId, session.user.id)
  if (!access?.membership) return json(404, { error: 'Workspace not found.' })
  if (!can(access, CAP.MANAGE_PLAYLISTS)) {
    return json(403, {
      error:
        access.workspace.status !== 'connected'
          ? 'This workspace is disconnected and read-only.'
          : 'You cannot change playlist covers here.',
    })
  }
  if (!(await getFlag(db, 'uploads_enabled'))) {
    return json(503, { error: 'Uploads are paused right now. Try again later.' })
  }

  const playlist = await db.query.playlists.findFirst({
    where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)),
    columns: { id: true },
  })
  if (!playlist) return json(404, { error: 'That playlist no longer exists.' })

  if (access.workspace.storageUsedBytes + sizeBytes > effectiveQuotaBytes(access.workspace)) {
    return json(409, { error: 'Not enough storage left for this image.' })
  }

  const key = keys.playlistCover(
    workspaceId,
    playlistId,
    randomBytes(8).toString('hex'),
    COVER_TYPES[contentType],
  )
  try {
    const url = await getStorage().presignUpload(key, contentType, sizeBytes, 300)
    return json(200, { url, key })
  } catch (err) {
    console.error('[playlists/cover] presign failed', err)
    return json(500, { error: 'Could not start the upload. Try again.' })
  }
}
