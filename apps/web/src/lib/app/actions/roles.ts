'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { logAudit, memberships, roles } from '@ume/db'
import { CAP, newId, roleUpsertSchema, sanitizeCapsForNonOwner } from '@ume/shared'
import { db } from '@/lib/db'
import { AppError, guard, runAction, type ActionResult, type Guarded } from '@/lib/app/guard'
import { workspacePath } from '@/lib/app/nav'

const MAX_CUSTOM_ROLES = 20

function assertGrantable(g: Guarded, caps: number): void {
  if (g.access.isOwner) return
  if ((caps & ~g.access.caps) !== 0) throw new AppError('You cannot grant permissions you do not have yourself.')
}

export async function createRole(
  workspaceId: string,
  input: { name: string; color?: string; capabilities: number },
): Promise<ActionResult<{ roleId: string }>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_ROLES)
    const data = roleUpsertSchema.parse(input)
    const caps = sanitizeCapsForNonOwner(data.capabilities)
    assertGrantable(g, caps)
    const [agg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(roles)
      .where(and(eq(roles.workspaceId, workspaceId), isNull(roles.systemKey)))
    if ((agg?.count ?? 0) >= MAX_CUSTOM_ROLES) throw new AppError(`A workspace can have at most ${MAX_CUSTOM_ROLES} custom roles.`)
    const [row] = await db
      .insert(roles)
      .values({
        id: newId('role'),
        workspaceId,
        name: data.name,
        color: data.color,
        capabilities: caps,
        position: 10 + (agg?.count ?? 0),
      })
      .returning({ id: roles.id })
    await logAudit(db, { workspaceId, actorUserId: g.user.id, action: 'role.create', targetType: 'role', targetId: row!.id, metadata: { name: data.name, caps } })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return { roleId: row!.id }
  })
}

export async function updateRole(
  workspaceId: string,
  roleId: string,
  input: { name: string; color?: string; capabilities: number },
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_ROLES)
    const role = await db.query.roles.findFirst({ where: and(eq(roles.id, roleId), eq(roles.workspaceId, workspaceId)) })
    if (!role) throw new AppError('That role does not exist.')
    if (role.systemKey === 'owner') throw new AppError('The Owner role cannot be edited.')
    const data = roleUpsertSchema.parse(input)
    const caps = sanitizeCapsForNonOwner(data.capabilities)
    // Non-owners may neither grant caps they lack nor touch a role that already outranks them.
    assertGrantable(g, caps)
    assertGrantable(g, role.capabilities)
    if (!g.access.isOwner && g.access.role?.id === role.id && (caps & CAP.MANAGE_ROLES) === 0) {
      throw new AppError('You cannot remove "Manage roles" from your own role.')
    }
    await db
      .update(roles)
      .set({ name: data.name, color: data.color, capabilities: caps, updatedAt: new Date() })
      .where(and(eq(roles.id, roleId), eq(roles.workspaceId, workspaceId)))
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      action: 'role.update',
      targetType: 'role',
      targetId: roleId,
      metadata: { name: data.name, caps, previousCaps: role.capabilities },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return undefined
  })
}

/** Delete a custom role; members holding it fall back to Listener. */
export async function deleteRole(workspaceId: string, roleId: string): Promise<ActionResult<{ reassigned: number }>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_ROLES)
    const role = await db.query.roles.findFirst({ where: and(eq(roles.id, roleId), eq(roles.workspaceId, workspaceId)) })
    if (!role) throw new AppError('That role does not exist.')
    if (role.systemKey) throw new AppError('System roles (Owner, Admin, Contributor, Listener) cannot be deleted. You can rename them instead.')
    assertGrantable(g, role.capabilities)
    const peon = await db.query.roles.findFirst({ where: and(eq(roles.workspaceId, workspaceId), eq(roles.systemKey, 'peon')) })
    if (!peon) throw new AppError('The Listener role is missing; reload the page and try again.')
    const moved = await db
      .update(memberships)
      .set({ roleId: peon.id, updatedAt: new Date() })
      .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.roleId, roleId)))
      .returning({ id: memberships.id })
    await db.delete(roles).where(and(eq(roles.id, roleId), eq(roles.workspaceId, workspaceId)))
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      action: 'role.delete',
      targetType: 'role',
      targetId: roleId,
      metadata: { name: role.name, reassigned: moved.length },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return { reassigned: moved.length }
  })
}
