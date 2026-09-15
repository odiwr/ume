import { and, eq, sql } from 'drizzle-orm'
import { DEFAULT_ROLES, getPlan, newId, type SystemRoleKey } from '@ume/shared'
import type { Db } from '../client'
import { activityEvents, memberships, roles, workspaces, type Role, type Workspace } from '../schema'

export async function getWorkspaceByGuildId(db: Db, guildId: string): Promise<Workspace | undefined> {
  return db.query.workspaces.findFirst({ where: eq(workspaces.guildId, guildId) })
}

export async function getWorkspaceById(db: Db, id: string): Promise<Workspace | undefined> {
  return db.query.workspaces.findFirst({ where: eq(workspaces.id, id) })
}

export async function getWorkspaceByUmeId(db: Db, umeId: string): Promise<Workspace | undefined> {
  return db.query.workspaces.findFirst({ where: eq(workspaces.umeId, umeId) })
}

/** Effective quota in bytes: CEO override wins over the plan. */
export function effectiveQuotaBytes(ws: Pick<Workspace, 'plan' | 'storageQuotaOverrideBytes'>): number {
  return ws.storageQuotaOverrideBytes ?? getPlan(ws.plan).storageBytes
}

/** Creates the four system roles if missing and returns them keyed by systemKey. */
export async function ensureDefaultRoles(db: Db, workspaceId: string): Promise<Record<SystemRoleKey, Role>> {
  const existing = await db.query.roles.findMany({ where: eq(roles.workspaceId, workspaceId) })
  const byKey = new Map(existing.filter((r) => r.systemKey).map((r) => [r.systemKey as SystemRoleKey, r]))
  for (const def of DEFAULT_ROLES) {
    if (byKey.has(def.key)) continue
    const [row] = await db
      .insert(roles)
      .values({
        id: newId('role'),
        workspaceId,
        name: def.name,
        description: def.description,
        color: def.color,
        capabilities: def.capabilities,
        systemKey: def.key,
        position: def.position,
      })
      .onConflictDoNothing()
      .returning()
    if (row) byKey.set(def.key, row)
  }
  // Re-read in case of conflicts.
  const all = await db.query.roles.findMany({ where: eq(roles.workspaceId, workspaceId) })
  const out = {} as Record<SystemRoleKey, Role>
  for (const r of all) if (r.systemKey) out[r.systemKey as SystemRoleKey] = r
  // Default role for signed-in Discord members = Peon (read-only) if not set.
  const ws = await getWorkspaceById(db, workspaceId)
  if (ws && !ws.defaultRoleId && out.peon) {
    await db.update(workspaces).set({ defaultRoleId: out.peon.id }).where(eq(workspaces.id, workspaceId))
  }
  return out
}

/** Give `userId` the Owner role (idempotent). Demotes any previous owner membership to Master. */
export async function setWorkspaceOwner(db: Db, workspaceId: string, userId: string): Promise<void> {
  const sys = await ensureDefaultRoles(db, workspaceId)
  await db.transaction(async (tx) => {
    // Demote previous owner (if different).
    await tx
      .update(memberships)
      .set({ roleId: sys.master.id, source: 'manual', updatedAt: new Date() })
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.roleId, sys.owner.id),
          sql`${memberships.userId} <> ${userId}`,
        ),
      )
    await tx
      .insert(memberships)
      .values({ id: newId('membership'), workspaceId, userId, roleId: sys.owner.id, source: 'owner' })
      .onConflictDoUpdate({
        target: [memberships.workspaceId, memberships.userId],
        set: { roleId: sys.owner.id, source: 'owner', expiresAt: null, updatedAt: new Date() },
      })
    await tx.update(workspaces).set({ ownerUserId: userId, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
  })
}

export interface TouchActivityInput {
  kind: (typeof activityEvents.$inferInsert)['kind']
  discordUserId?: string | null
  userId?: string | null
  metadata?: Record<string, unknown>
}

/** Records an activity event and bumps last_activity_at (which also clears inactivity notices). */
export async function touchActivity(db: Db, workspaceId: string, input: TouchActivityInput): Promise<void> {
  const now = new Date()
  await db.insert(activityEvents).values({
    id: newId('activity'),
    workspaceId,
    kind: input.kind,
    discordUserId: input.discordUserId ?? null,
    userId: input.userId ?? null,
    metadata: input.metadata ?? {},
    createdAt: now,
  })
  await db
    .update(workspaces)
    .set({
      lastActivityAt: now,
      inactivityNotice30dSentAt: null,
      inactivityNotice48hSentAt: null,
      updatedAt: now,
    })
    .where(eq(workspaces.id, workspaceId))
}

export async function setBotPresence(
  db: Db,
  guildId: string,
  presence: { connected: boolean; voiceChannelId?: string | null; inGuild?: boolean },
): Promise<void> {
  await db
    .update(workspaces)
    .set({
      botConnected: presence.connected,
      botLastSeenAt: new Date(),
      ...(presence.voiceChannelId !== undefined ? { botVoiceChannelId: presence.voiceChannelId } : {}),
      ...(presence.inGuild !== undefined ? { botInGuild: presence.inGuild } : {}),
    })
    .where(eq(workspaces.guildId, guildId))
}
