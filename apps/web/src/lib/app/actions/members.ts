'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { discordRoleMaps, logAudit, memberships, roles, workspaces } from '@ume/db'
import { CAP, newId } from '@ume/shared'
import { db } from '@/lib/db'
import { AppError, guard, runAction, type ActionResult, type Guarded } from '@/lib/app/guard'
import { workspacePath } from '@/lib/app/nav'

/** A non-owner may only hand out (or touch) roles whose capabilities they hold themselves. */
function assertCanHandleRole(g: Guarded, roleCaps: number, what: string): void {
  if (g.access.isOwner) return
  if ((roleCaps & ~g.access.caps) !== 0) throw new AppError(`You cannot ${what} a role with permissions you do not have.`)
}

async function loadRole(workspaceId: string, roleId: string) {
  const role = await db.query.roles.findFirst({ where: and(eq(roles.id, roleId), eq(roles.workspaceId, workspaceId)) })
  if (!role) throw new AppError('That role does not exist in this workspace.')
  return role
}

async function loadTargetMembership(g: Guarded, membershipId: string) {
  const target = await db.query.memberships.findFirst({
    where: and(eq(memberships.id, membershipId), eq(memberships.workspaceId, g.workspace.id)),
    with: { role: true },
  })
  if (!target) throw new AppError('That member is no longer in the workspace.')
  if (target.userId === g.workspace.ownerUserId || target.role.systemKey === 'owner') {
    throw new AppError('The Owner’s membership cannot be changed.')
  }
  assertCanHandleRole(g, target.role.capabilities, 'change a member holding')
  return target
}

export async function changeMemberRole(workspaceId: string, membershipId: string, roleId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_MEMBERS)
    const target = await loadTargetMembership(g, membershipId)
    const role = await loadRole(workspaceId, roleId)
    if (role.systemKey === 'owner') throw new AppError('The Owner role cannot be assigned. Ownership moves with the Discord server owner.')
    assertCanHandleRole(g, role.capabilities, 'assign')
    await db
      .update(memberships)
      .set({ roleId: role.id, source: 'manual', updatedAt: new Date() })
      .where(and(eq(memberships.id, target.id), eq(memberships.workspaceId, workspaceId)))
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      action: 'member.role',
      targetType: 'user',
      targetId: target.userId,
      metadata: { from: target.roleId, to: role.id },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return undefined
  })
}

export async function removeMember(workspaceId: string, membershipId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_MEMBERS)
    const target = await loadTargetMembership(g, membershipId)
    await db.delete(memberships).where(and(eq(memberships.id, target.id), eq(memberships.workspaceId, workspaceId)))
    await logAudit(db, { workspaceId, actorUserId: g.user.id, action: 'member.remove', targetType: 'user', targetId: target.userId })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return undefined
  })
}

export async function setMemberExpiry(workspaceId: string, membershipId: string, expiresAt: string | null): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_MEMBERS)
    const target = await loadTargetMembership(g, membershipId)
    const date = expiresAt ? z.coerce.date().parse(expiresAt) : null
    if (date && date.getTime() < Date.now()) throw new AppError('Pick a date in the future.')
    await db
      .update(memberships)
      .set({ expiresAt: date, updatedAt: new Date() })
      .where(and(eq(memberships.id, target.id), eq(memberships.workspaceId, workspaceId)))
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      action: 'member.expiry',
      targetType: 'user',
      targetId: target.userId,
      metadata: { expiresAt: date?.toISOString() ?? null },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return undefined
  })
}

/** Map a Discord role to an Ume role; `roleId` null removes the mapping. */
export async function upsertRoleMap(
  workspaceId: string,
  input: { discordRoleId: string; discordRoleName: string; roleId: string | null },
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_SETTINGS)
    const discordRoleId = z.string().regex(/^\d{5,25}$/).parse(input.discordRoleId)
    const discordRoleName = z.string().trim().min(1).max(100).parse(input.discordRoleName)
    if (!input.roleId) {
      await db.delete(discordRoleMaps).where(and(eq(discordRoleMaps.workspaceId, workspaceId), eq(discordRoleMaps.discordRoleId, discordRoleId)))
    } else {
      const role = await loadRole(workspaceId, input.roleId)
      if (role.systemKey === 'owner') throw new AppError('The Owner role cannot be mapped to a Discord role.')
      assertCanHandleRole(g, role.capabilities, 'map')
      await db
        .insert(discordRoleMaps)
        .values({ id: newId('roleMap'), workspaceId, discordRoleId, discordRoleName, roleId: role.id })
        .onConflictDoUpdate({
          target: [discordRoleMaps.workspaceId, discordRoleMaps.discordRoleId],
          set: { roleId: role.id, discordRoleName },
        })
    }
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      action: 'settings.role_map',
      targetType: 'discord_role',
      targetId: discordRoleId,
      metadata: { roleId: input.roleId, discordRoleName },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return undefined
  })
}

export async function setDefaultRole(workspaceId: string, roleId: string | null): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_SETTINGS)
    if (roleId) {
      const role = await loadRole(workspaceId, roleId)
      if (role.systemKey === 'owner') throw new AppError('The Owner role cannot be the default.')
      assertCanHandleRole(g, role.capabilities, 'set as default')
    }
    await db.update(workspaces).set({ defaultRoleId: roleId, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
    await logAudit(db, { workspaceId, actorUserId: g.user.id, action: 'settings.default_role', metadata: { roleId } })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return undefined
  })
}

export async function setRoleSync(workspaceId: string, enabled: boolean): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_SETTINGS)
    await db.update(workspaces).set({ discordRoleSyncEnabled: !!enabled, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
    await logAudit(db, { workspaceId, actorUserId: g.user.id, action: 'settings.role_sync', metadata: { enabled: !!enabled } })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return undefined
  })
}
