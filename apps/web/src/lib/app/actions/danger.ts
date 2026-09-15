'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { invites, logAudit, removeAllMembersExceptOwner, workspaces } from '@ume/db'
import { JOBS } from '@ume/shared'
import { db } from '@/lib/db'
import { enqueue } from '@/lib/queue'
import { AppError, guardOwner, runAction, type ActionResult } from '@/lib/app/guard'
import { workspacePath } from '@/lib/app/nav'

function assertTypedName(typed: string, guildName: string): void {
  if (typed.trim() !== guildName.trim()) throw new AppError('Type the server name exactly as shown to confirm.')
}

/** Owner only: remove every member except the Owner, revoke invites, disconnect. Music stays. */
export async function resetWorkspace(workspaceId: string, typedName: string): Promise<ActionResult<{ removed: number }>> {
  return runAction(async () => {
    const g = await guardOwner(workspaceId)
    assertTypedName(typedName, g.workspace.guildName)
    const removed = await removeAllMembersExceptOwner(db, workspaceId)
    await db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.workspaceId, workspaceId), isNull(invites.revokedAt)))
    await db
      .update(workspaces)
      .set({ status: 'disconnected', disconnectedAt: new Date(), updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      actorDiscordId: g.user.discordUserId ?? null,
      action: 'workspace.reset',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { removedMembers: removed, via: 'web' },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return { removed }
  })
}

/** Owner only: delete everything. The worker does the actual deletion. */
export async function purgeWorkspace(workspaceId: string, typedName: string): Promise<ActionResult<undefined>> {
  const result = await runAction(async () => {
    const g = await guardOwner(workspaceId)
    assertTypedName(typedName, g.workspace.guildName)
    if (g.workspace.status === 'purging') throw new AppError('This workspace is already being purged.')
    await db.update(workspaces).set({ status: 'purging', updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
    await enqueue(JOBS.purgeWorkspace, { workspaceId, reason: 'owner', requestedByUserId: g.user.id })
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      actorDiscordId: g.user.discordUserId ?? null,
      action: 'workspace.purge',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { via: 'web' },
    })
    revalidatePath('/app', 'layout')
    return undefined
  })
  if (result.ok) redirect('/app')
  return result
}
