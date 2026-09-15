'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { playlistTracks, playlists, can, logAudit, recountPlaylist, touchActivity, tracks } from '@ume/db'
import { PLAYLIST, CAP, JOBS, newId, parseMediaLink, trackMetaSchema, mediaLinkSchema } from '@ume/shared'
import { db } from '@/lib/db'
import { enqueue } from '@/lib/queue'
import { AppError, guard, runAction, type ActionResult } from '@/lib/app/guard'
import { deleteOrphanTracks } from '@/lib/app/library'
import { EXTRACTION_NOTICES, extractionState, fetchLinkMetadata, type ExtractionState } from '@/lib/app/links'
import { workspacePath } from '@/lib/app/nav'

async function nextPosition(playlistId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${playlistTracks.position}), -1)::int` })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId))
  return (row?.max ?? -1) + 1
}

/** Add a song from a link (YouTube, SoundCloud, Bandcamp, Audius, …) to a playlist. */
export async function addLinkToPlaylist(
  workspaceId: string,
  playlistId: string,
  url: string,
): Promise<ActionResult<{ trackId: string; extracting: boolean; notice: string | null; title: string }>> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.ADD_TRACK)
    const parsedUrl = mediaLinkSchema.parse(url)
    const link = parseMediaLink(parsedUrl)
    if (!link) throw new AppError('Paste a link to a single track from a supported site.')
    const playlist = await db.query.playlists.findFirst({ where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)) })
    if (!playlist) throw new AppError('That playlist no longer exists.')

    const bySource = and(eq(tracks.workspaceId, workspaceId), eq(tracks.sourceSite, link.site), eq(tracks.sourceId, link.id))
    let track = await db.query.tracks.findFirst({ where: bySource })
    let extracting = false
    let notice: string | null = null

    if (!track) {
      const [agg] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, playlistId))
      if ((agg?.count ?? 0) >= PLAYLIST.maxTracks) throw new AppError(`A playlist holds at most ${PLAYLIST.maxTracks} tracks.`)

      const state = await extractionState(workspace)
      extracting = state === 'allowed'
      if (!extracting) notice = EXTRACTION_NOTICES[state as Exclude<ExtractionState, 'allowed'>]
      const meta = await fetchLinkMetadata(link)

      const [row] = await db
        .insert(tracks)
        .values({
          id: newId('track'),
          workspaceId,
          source: 'link',
          status: extracting ? 'pending' : 'ready',
          title: meta.title,
          artist: meta.author,
          sourceSite: link.site,
          sourceId: link.id,
          sourceUrl: link.canonicalUrl,
          sourceAuthor: meta.author,
          coverUrl: meta.coverUrl,
          uploadedByUserId: user.id,
          uploadedByDiscordId: user.discordUserId ?? null,
          addedVia: 'web',
          readyAt: extracting ? null : new Date(),
        })
        .onConflictDoNothing()
        .returning()
      track = row ?? (await db.query.tracks.findFirst({ where: bySource }))
      if (!track) throw new AppError('Could not save that link. Try again.')
      if (extracting && row) {
        await enqueue(JOBS.extractLink, {
          trackId: track.id,
          workspaceId,
          sourceSite: link.site,
          sourceId: link.id,
          sourceUrl: link.canonicalUrl,
          requestedByUserId: user.id,
          requestedByDiscordId: user.discordUserId ?? null,
        })
      }
    } else {
      extracting = track.status === 'pending' || track.status === 'processing'
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
    if (!inserted.length) throw new AppError('That song is already in this playlist.')

    await recountPlaylist(db, playlistId)
    await touchActivity(db, workspaceId, {
      kind: 'web_action',
      userId: user.id,
      metadata: { action: 'track.add', source: 'link', site: link.site, playlistId },
    })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return { trackId: track.id, extracting, notice, title: track.title }
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

/** Re-queue a failed upload or link extraction (keeps the original object if it still exists). */
export async function retryTrack(workspaceId: string, trackId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { workspace, user } = await guard(workspaceId, CAP.ADD_TRACK)
    const track = await db.query.tracks.findFirst({ where: and(eq(tracks.id, trackId), eq(tracks.workspaceId, workspaceId)) })
    if (!track || track.status !== 'failed') throw new AppError('Only failed tracks can be retried.')
    if (track.source === 'upload') {
      if (!track.originalStorageKey) throw new AppError('The original file is gone. Upload it again.')
      await db.update(tracks).set({ status: 'pending', errorMessage: null, updatedAt: new Date() }).where(eq(tracks.id, track.id))
      await enqueue(JOBS.transcodeUpload, { trackId: track.id, workspaceId })
    } else {
      if (!track.sourceSite || !track.sourceId || !track.sourceUrl) throw new AppError('This link cannot be retried.')
      const state = await extractionState(workspace)
      if (state !== 'allowed') throw new AppError(EXTRACTION_NOTICES[state])
      await db.update(tracks).set({ status: 'pending', errorMessage: null, updatedAt: new Date() }).where(eq(tracks.id, track.id))
      await enqueue(JOBS.extractLink, {
        trackId: track.id,
        workspaceId,
        sourceSite: track.sourceSite,
        sourceId: track.sourceId,
        sourceUrl: track.sourceUrl,
        requestedByUserId: user.id,
        requestedByDiscordId: user.discordUserId ?? null,
      })
    }
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return undefined
  })
}
