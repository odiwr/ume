'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { playlists, logAudit, touchActivity } from '@ume/db'
import { PLAYLIST, CAP, playlistNameSchema, newId, slugify } from '@ume/shared'
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

export async function createPlaylist(workspaceId: string, input: { name: string; emoji?: string | null }): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.MANAGE_PLAYLISTS)
    const name = playlistNameSchema.parse(input.name)
    const [agg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playlists)
      .where(eq(playlists.workspaceId, workspaceId))
    if ((agg?.count ?? 0) >= PLAYLIST.maxPerWorkspace) throw new AppError(`A workspace can have at most ${PLAYLIST.maxPerWorkspace} playlists.`)
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
    await touchActivity(db, workspaceId, { kind: 'web_action', userId: user.id, metadata: { action: 'playlist.create', name } })
    await logAudit(db, { workspaceId, actorUserId: user.id, action: 'playlist.create', targetType: 'playlist', targetId: row!.id, metadata: { name } })
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
    const playlist = await db.query.playlists.findFirst({ where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)) })
    if (!playlist) throw new AppError('That playlist no longer exists.')
    const name = playlistNameSchema.parse(input.name)
    const slug = name === playlist.name ? playlist.slug : await uniqueSlug(workspaceId, name, playlist.id)
    await db
      .update(playlists)
      .set({
        name,
        slug,
        emoji: input.emoji === undefined ? playlist.emoji : input.emoji?.trim() || null,
        description: input.description === undefined ? playlist.description : input.description?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)))
    await logAudit(db, { workspaceId, actorUserId: user.id, action: 'playlist.update', targetType: 'playlist', targetId: playlistId, metadata: { name } })
    revalidatePath(workspacePath(workspace.umeId), 'layout')
    return { slug }
  })
}

export async function deletePlaylist(workspaceId: string, playlistId: string): Promise<ActionResult<{ removedTracks: number }>> {
  return runAction(async () => {
    const { user, workspace } = await guard(workspaceId, CAP.MANAGE_PLAYLISTS)
    const playlist = await db.query.playlists.findFirst({ where: and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)) })
    if (!playlist) throw new AppError('That playlist no longer exists.')
    await db.delete(playlists).where(and(eq(playlists.id, playlistId), eq(playlists.workspaceId, workspaceId)))
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
