'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { playlistTracks, playlists, can, getFlag, logAudit, recountPlaylist, touchActivity, tracks } from '@ume/db'
import { PLAYLIST, CAP, JOBS, newId, parseYouTubeId, trackMetaSchema, mediaLinkSchema } from '@ume/shared'
import { db } from '@/lib/db'
import { enqueue } from '@/lib/queue'
import { AppError, guard, runAction, type ActionResult } from '@/lib/app/guard'
import { deleteOrphanTracks } from '@/lib/app/library'
import { workspacePath } from '@/lib/app/nav'

interface OEmbed {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

async function fetchOEmbed(canonicalUrl: string): Promise<OEmbed | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return (await res.json()) as OEmbed
  } catch {
    return null
  }
}

async function nextPosition(playlistId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${playlistTracks.position}), -1)::int` })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId))
  return (row?.max ?? -1) + 1
}

/** Add a YouTube link to a playlist as a linked entry (or queue ingestion when the global flag is on). */
export async function addYouTubeLink(workspaceId: string, playlistId: string, url: string): Promise<ActionResult<{ trackId: string; linked: boolean }>> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.ADD_TRACK)
    if (!workspace.linkExtractEnabled) throw new AppError('YouTube links are turned off for this server. A Master can enable them in Settings.')
    const parsedUrl = mediaLinkSchema.parse(url)
    const sourceId = parseYouTubeId(parsedUrl)
    if (!sourceId) throw new AppError('That does not look like a YouTube video link.')
    const playlist = await db.query.playlists.findFirst({ where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)) })
    if (!playlist) throw new AppError('That playlist no longer exists.')

    let track = await db.query.tracks.findFirst({ where: and(eq(tracks.workspaceId, workspaceId), eq(tracks.sourceId, sourceId)) })
    let linked = true
    if (!track) {
      const [agg] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, playlistId))
      if ((agg?.count ?? 0) >= PLAYLIST.maxTracks) throw new AppError(`A playlist holds at most ${PLAYLIST.maxTracks} tracks.`)
      const canonical = `https://www.youtube.com/watch?v=${sourceId}`
      const meta = await fetchOEmbed(canonical)
      const ingest = await getFlag(db, 'link_extract')
      linked = !ingest
      const [row] = await db
        .insert(tracks)
        .values({
          id: newId('track'),
          workspaceId,
          source: 'link',
          status: ingest ? 'pending' : 'ready',
          title: meta?.title?.trim() || `YouTube video ${sourceId}`,
          artist: meta?.author_name?.trim() || null,
          sourceId,
          sourceUrl: canonical,
          sourceAuthor: meta?.author_name?.trim() || null,
          coverUrl: meta?.thumbnail_url ?? `https://i.ytimg.com/vi/${sourceId}/hqdefault.jpg`,
          uploadedByUserId: user.id,
          uploadedByDiscordId: user.discordUserId ?? null,
          addedVia: 'web',
          readyAt: ingest ? null : new Date(),
        })
        .onConflictDoNothing()
        .returning()
      track = row ?? (await db.query.tracks.findFirst({ where: and(eq(tracks.workspaceId, workspaceId), eq(tracks.sourceId, sourceId)) }))
      if (!track) throw new AppError('Could not save that link. Try again.')
      if (ingest && row) {
        await enqueue(JOBS.extractLink, { trackId: track.id, workspaceId, sourceId, requestedByUserId: user.id })
      }
    } else {
      linked = track.status === 'ready' && !track.storageKey
    }

    const inserted = await db
      .insert(playlistTracks)
      .values({
        id: newId('playlistTrack'),
        playlistId,
        trackId: track.id,
        workspaceId,
        addedByUserId: user.id,
        addedByDiscordId: user.discordUserId ?? null,
        addedVia: 'web',
        position: await nextPosition(playlistId),
      })
      .onConflictDoNothing()
      .returning({ id: playlistTracks.id })
    if (!inserted.length) throw new AppError('That video is already in this playlist.')

    await recountPlaylist(db, playlistId)
    await touchActivity(db, workspaceId, { kind: 'web_action', userId: user.id, metadata: { action: 'track.add', source: 'link', playlistId } })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return { trackId: track.id, linked }
  })
}

export async function updateTrackMeta(
  workspaceId: string,
  trackId: string,
  input: { title: string; artist: string | null; album: string | null },
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.EDIT_TRACK_META)
    const meta = trackMetaSchema.parse(input)
    const updated = await db
      .update(tracks)
      .set({ title: meta.title, artist: meta.artist || null, album: meta.album || null, updatedAt: new Date() })
      .where(and(eq(tracks.id, trackId), eq(tracks.workspaceId, workspaceId)))
      .returning({ id: tracks.id })
    if (!updated.length) throw new AppError('That track no longer exists.')
    await logAudit(db, { workspaceId, actorUserId: user.id, action: 'track.update', targetType: 'track', targetId: trackId, metadata: meta })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return undefined
  })
}

/** Remove a track from a playlist. Tracks left in no playlist are deleted from storage too. */
export async function removeTrackFromPlaylist(workspaceId: string, playlistId: string, trackId: string): Promise<ActionResult<{ deleted: boolean }>> {
  return runAction(async () => {
    const { user, access, workspace } = await guard(workspaceId, CAP.VIEW_LIBRARY)
    const entry = await db.query.playlistTracks.findFirst({
      where: and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackId), eq(playlistTracks.workspaceId, workspaceId)),
    })
    if (!entry) throw new AppError('That track is not in this playlist.')
    const mine = entry.addedByUserId === user.id
    if (!(can(access, CAP.DELETE_ANY_TRACK) || (mine && can(access, CAP.DELETE_OWN_TRACK)))) {
      throw new AppError(mine ? 'You cannot remove tracks in this workspace.' : 'You can only remove tracks you added.')
    }
    await db.delete(playlistTracks).where(eq(playlistTracks.id, entry.id))
    const deleted = (await deleteOrphanTracks(workspaceId)) > 0
    await recountPlaylist(db, playlistId)
    await logAudit(db, {
      workspaceId,
      actorUserId: user.id,
      action: 'track.remove',
      targetType: 'track',
      targetId: trackId,
      metadata: { playlistId, deleted, own: mine },
    })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return { deleted }
  })
}

/** Re-queue a failed upload/ingest (keeps the original object if it still exists). */
export async function retryTrack(workspaceId: string, trackId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { workspace } = await guard(workspaceId, CAP.ADD_TRACK)
    const track = await db.query.tracks.findFirst({ where: and(eq(tracks.id, trackId), eq(tracks.workspaceId, workspaceId)) })
    if (!track || track.status !== 'failed') throw new AppError('Only failed tracks can be retried.')
    if (track.source === 'upload') {
      if (!track.originalStorageKey) throw new AppError('The original file is gone. Upload it again.')
      await db.update(tracks).set({ status: 'pending', errorMessage: null, updatedAt: new Date() }).where(eq(tracks.id, track.id))
      await enqueue(JOBS.transcodeUpload, { trackId: track.id, workspaceId })
    } else {
      if (!track.sourceId) throw new AppError('This link cannot be retried.')
      if (!(await getFlag(db, 'link_extract'))) throw new AppError('YouTube ingestion is turned off globally.')
      await db.update(tracks).set({ status: 'pending', errorMessage: null, updatedAt: new Date() }).where(eq(tracks.id, track.id))
      await enqueue(JOBS.extractLink, { trackId: track.id, workspaceId, sourceId: track.sourceId })
    }
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return undefined
  })
}
