import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { can, getAccess, getFlag, playlistTracks, playlists, tracks } from '@ume/db'
import { CAP, PLAYLIST, UPLOAD, formatBytes, newId, uploadRequestSchema } from '@ume/shared'
import { getStorage, keys } from '@ume/storage'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { failUpload, isAcceptedUpload, reserveUpload } from '@/lib/app/upload'

export const dynamic = 'force-dynamic'

const bodySchema = uploadRequestSchema.extend({ workspaceId: z.string().min(1) })

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status })
}

/**
 * Step 1 of an upload: validate, reserve quota, create the pending track and hand the
 * browser a presigned PUT URL. The web server never touches the audio bytes.
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.user.banned) return json(401, { error: 'Sign in to upload.' })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json(400, { error: parsed.error.issues[0]?.message ?? 'Invalid upload request.' })
  const { workspaceId, playlistId, filename, sizeBytes, mimeType } = parsed.data

  const access = await getAccess(db, workspaceId, session.user.id)
  if (!access?.membership) return json(404, { error: 'Workspace not found.' })
  if (!can(access, CAP.ADD_TRACK)) {
    return json(403, {
      error: access.workspace.status !== 'connected' ? 'This workspace is disconnected and read-only.' : 'You cannot add music here.',
    })
  }
  if (!(await getFlag(db, 'uploads_enabled'))) return json(503, { error: 'Uploads are paused right now. Try again later.' })
  if (!isAcceptedUpload(filename, mimeType)) {
    return json(415, { error: `That file type is not supported. Use ${UPLOAD.acceptedExtensions.join(', ')}.` })
  }

  const playlist = await db.query.playlists.findFirst({ where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)) })
  if (!playlist) return json(404, { error: 'That playlist no longer exists.' })
  const [agg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId))
  if ((agg?.count ?? 0) >= PLAYLIST.maxTracks) return json(409, { error: `A playlist holds at most ${PLAYLIST.maxTracks} tracks.` })

  const reserved = await reserveUpload(access.workspace, sizeBytes)
  if (!reserved.ok) {
    const messages = {
      quota: `Not enough storage left for a ${formatBytes(sizeBytes)} file. Free some space or upgrade the plan.`,
      tracks: 'This workspace has reached its track limit for the current plan.',
      disconnected: 'This workspace is disconnected and read-only.',
    }
    return json(409, { error: messages[reserved.reason] })
  }

  const trackId = newId('track')
  const key = keys.upload(workspaceId, trackId, filename)
  const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled'
  try {
    await db.transaction(async (tx) => {
      await tx.insert(tracks).values({
        id: trackId,
        workspaceId,
        source: 'upload',
        status: 'pending',
        title,
        originalStorageKey: key,
        originalFilename: filename,
        originalMimeType: mimeType,
        originalSizeBytes: sizeBytes,
        sizeBytes,
        uploadedByUserId: session.user.id,
        uploadedByDiscordId: session.user.discordUserId ?? null,
        addedVia: 'web',
      })
      const [pos] = await tx
        .select({ max: sql<number>`coalesce(max(${playlistTracks.position}), -1)::int` })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, playlistId))
      await tx.insert(playlistTracks).values({
        id: newId('playlistTrack'),
        playlistId,
        trackId,
        workspaceId,
        addedByUserId: session.user.id,
        addedByDiscordId: session.user.discordUserId ?? null,
        addedVia: 'web',
        position: (pos?.max ?? -1) + 1,
      })
    })
    const url = await getStorage().presignUpload(key, mimeType || 'application/octet-stream', sizeBytes)
    return json(200, { trackId, url, key })
  } catch (err) {
    console.error('[upload/presign]', err)
    await failUpload(workspaceId, trackId, 'Could not start the upload.').catch(() => undefined)
    return json(500, { error: 'Could not start the upload. Try again.' })
  }
}
