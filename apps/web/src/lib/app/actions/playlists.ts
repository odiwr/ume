'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { playlists, logAudit, touchActivity } from '@ume/db'
import { PLAYLIST, CAP, playlistNameSchema, newId, slugify } from '@ume/shared'
import { getStorage, isPlaylistCoverKey } from '@ume/storage'
import { z } from 'zod'
import {
  COVER_MAX_BYTES,
  COVER_TYPES,
  isCoverContentType,
} from '@/components/app/library/playlist-cover-rules'
import { db } from '@/lib/db'
import { AppError, guard, runAction, type ActionResult } from '@/lib/app/guard'
import { workspacePath } from '@/lib/app/nav'
import { deleteOrphanTracks } from '@/lib/app/library'

async function uniqueSlug(workspaceId: string, name: string, exceptId?: string): Promise<string> {
  const base = slugify(name)
  let slug = base
  for (let i = 2; i < 100; i++) {
    const clash = await db.query.playlists.findFirst({
      where: and(eq(playlists.workspaceId, workspaceId), eq(playlists.slug, slug)),
      columns: { id: true },
    })
    if (!clash || clash.id === exceptId) return slug
    slug = `${base}-${i}`
  }
  throw new AppError('Pick a different name; too many playlists share this one.')
}

export async function createPlaylist(
  workspaceId: string,
  input: { name: string; emoji?: string | null },
): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.MANAGE_PLAYLISTS)
    const name = playlistNameSchema.parse(input.name)
    const [agg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playlists)
      .where(eq(playlists.workspaceId, workspaceId))
    if ((agg?.count ?? 0) >= PLAYLIST.maxPerWorkspace)
      throw new AppError(`A workspace can have at most ${PLAYLIST.maxPerWorkspace} playlists.`)
    const slug = await uniqueSlug(workspaceId, name)
    const [row] = await db
      .insert(playlists)
      .values({
        id: newId('playlist'),
        workspaceId,
        name,
        slug,
        emoji: input.emoji?.trim() || null,
        position: agg?.count ?? 0,
        createdByUserId: user.id,
      })
      .returning({ id: playlists.id, slug: playlists.slug })
    await touchActivity(db, workspaceId, {
      kind: 'web_action',
      userId: user.id,
      metadata: { action: 'playlist.create', name },
    })
    await logAudit(db, {
      workspaceId,
      actorUserId: user.id,
      action: 'playlist.create',
      targetType: 'playlist',
      targetId: row!.id,
      metadata: { name },
    })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return { slug: row!.slug }
  })
}

export async function renamePlaylist(
  workspaceId: string,
  playlistId: string,
  input: { name: string; emoji?: string | null; description?: string | null },
): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.MANAGE_PLAYLISTS)
    const playlist = await db.query.playlists.findFirst({
      where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)),
    })
    if (!playlist) throw new AppError('That playlist no longer exists.')
    const name = playlistNameSchema.parse(input.name)
    const slug =
      name === playlist.name ? playlist.slug : await uniqueSlug(workspaceId, name, playlist.id)
    await db
      .update(playlists)
      .set({
        name,
        slug,
        emoji: input.emoji === undefined ? playlist.emoji : input.emoji?.trim() || null,
        description:
          input.description === undefined
            ? playlist.description
            : input.description?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)))
    await logAudit(db, {
      workspaceId,
      actorUserId: user.id,
      action: 'playlist.update',
      targetType: 'playlist',
      targetId: playlistId,
      metadata: { name },
    })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return { slug }
  })
}

export async function deletePlaylist(
  workspaceId: string,
  playlistId: string,
): Promise<ActionResult<{ removedTracks: number }>> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.MANAGE_PLAYLISTS)
    const playlist = await db.query.playlists.findFirst({
      where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)),
    })
    if (!playlist) throw new AppError('That playlist no longer exists.')
    await db
      .delete(playlists)
      .where(and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)))
    if (playlist.coverStorageKey) await deleteCoverObject(playlist.coverStorageKey)
    const removedTracks = await deleteOrphanTracks(workspaceId)
    await logAudit(db, {
      workspaceId,
      actorUserId: user.id,
      action: 'playlist.delete',
      targetType: 'playlist',
      targetId: playlistId,
      metadata: { name: playlist.name, removedTracks },
    })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return { removedTracks }
  })
}

async function deleteCoverObject(key: string): Promise<void> {
  await getStorage()
    .deleteObject(key)
    .catch((err) => console.error('[playlist cover] delete failed', err))
}

const coverKeySchema = z.string().min(1).max(512)

/**
 * Step 2 of a cover upload (step 1 is POST /api/playlists/cover): confirm the object
 * landed with an allowed type and size, point the playlist at it and drop the old one.
 */
export async function setPlaylistCover(
  workspaceId: string,
  playlistId: string,
  key: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.MANAGE_PLAYLISTS)
    const coverKey = coverKeySchema.parse(key)
    if (!isPlaylistCoverKey(coverKey, workspaceId, playlistId))
      throw new AppError('That upload does not belong to this playlist.')
    const playlist = await db.query.playlists.findFirst({
      where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)),
    })
    if (!playlist) {
      await deleteCoverObject(coverKey)
      throw new AppError('That playlist no longer exists.')
    }
    if (playlist.coverStorageKey === coverKey) return undefined

    const head = await getStorage()
      .head(coverKey)
      .catch(() => null)
    if (!head) throw new AppError('The image never arrived in storage. Try again.')
    const type = (head.contentType ?? '').split(';')[0]!.trim().toLowerCase()
    if (
      head.size <= 0 ||
      head.size > COVER_MAX_BYTES ||
      !isCoverContentType(type) ||
      !coverKey.endsWith(`.${COVER_TYPES[type]}`)
    ) {
      await deleteCoverObject(coverKey)
      throw new AppError('Use a JPEG, PNG or WebP image up to 5 MB.')
    }

    // Only swap from the cover we just read, so a concurrent change never orphans an object.
    const updated = await db
      .update(playlists)
      .set({ coverStorageKey: coverKey, updatedAt: new Date() })
      .where(
        and(
          eq(playlists.id, playlistId),
          eq(playlists.workspaceId, workspaceId),
          playlist.coverStorageKey
            ? eq(playlists.coverStorageKey, playlist.coverStorageKey)
            : isNull(playlists.coverStorageKey),
        ),
      )
      .returning({ id: playlists.id })
    if (!updated.length) {
      await deleteCoverObject(coverKey)
      throw new AppError('The cover changed while you were uploading. Try again.')
    }
    if (playlist.coverStorageKey) await deleteCoverObject(playlist.coverStorageKey)
    await logAudit(db, {
      workspaceId,
      actorUserId: user.id,
      action: 'playlist.cover.set',
      targetType: 'playlist',
      targetId: playlistId,
      metadata: { name: playlist.name, bytes: head.size, replaced: !!playlist.coverStorageKey },
    })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return undefined
  })
}

export async function removePlaylistCover(
  workspaceId: string,
  playlistId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.MANAGE_PLAYLISTS)
    const playlist = await db.query.playlists.findFirst({
      where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)),
    })
    if (!playlist) throw new AppError('That playlist no longer exists.')
    if (!playlist.coverStorageKey) return undefined
    const updated = await db
      .update(playlists)
      .set({ coverStorageKey: null, updatedAt: new Date() })
      .where(
        and(
          eq(playlists.id, playlistId),
          eq(playlists.workspaceId, workspaceId),
          eq(playlists.coverStorageKey, playlist.coverStorageKey),
        ),
      )
      .returning({ id: playlists.id })
    if (!updated.length)
      throw new AppError('The cover changed in the meantime. Refresh and try again.')
    await deleteCoverObject(playlist.coverStorageKey)
    await logAudit(db, {
      workspaceId,
      actorUserId: user.id,
      action: 'playlist.cover.remove',
      targetType: 'playlist',
      targetId: playlistId,
      metadata: { name: playlist.name },
    })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return undefined
  })
}
