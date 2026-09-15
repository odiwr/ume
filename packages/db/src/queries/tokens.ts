import { and, eq, gt, isNull } from 'drizzle-orm'
import {
  CLAIM_TOKEN,
  generateClaimToken,
  hashToken,
  isClaimTokenShape,
  newId,
  newUmeId,
  normalizeClaimToken,
} from '@ume/shared'
import type { Db } from '../client'
import { claimTokens, users, workspaces, type Workspace } from '../schema'
import { ensureDefaultRoles, setWorkspaceOwner } from './workspaces'

export interface IssueTokenInput {
  guildId: string
  guildName: string
  guildIcon?: string | null
  guildOwnerDiscordId?: string | null
  issuedToDiscordId: string
}

export interface IssueTokenResult {
  token: string
  workspace: Workspace
  /** True when a previously connected workspace was disconnected by this rotation. */
  disconnected: boolean
}

/**
 * `~reload`: create the workspace row if needed, revoke all unclaimed tokens for the
 * guild, disconnect a connected workspace, and issue a fresh single-use token.
 */
export async function issueClaimToken(db: Db, input: IssueTokenInput): Promise<IssueTokenResult> {
  const token = generateClaimToken()
  const now = new Date()
  return db.transaction(async (tx) => {
    let ws = await tx.query.workspaces.findFirst({ where: eq(workspaces.guildId, input.guildId) })
    let disconnected = false
    if (!ws) {
      const [created] = await tx
        .insert(workspaces)
        .values({
          id: newId('workspace'),
          umeId: newUmeId(),
          guildId: input.guildId,
          guildName: input.guildName,
          guildIcon: input.guildIcon ?? null,
          guildOwnerDiscordId: input.guildOwnerDiscordId ?? null,
          status: 'unclaimed',
          botInGuild: true,
        })
        .returning()
      ws = created!
    } else {
      if (ws.status === 'purged' || ws.status === 'purging') {
        throw new Error('This server was purged. Wait for the purge to finish, then run ~reload again.')
      }
      disconnected = ws.status === 'connected'
      const [updated] = await tx
        .update(workspaces)
        .set({
          status: ws.ownerUserId ? 'disconnected' : 'unclaimed',
          disconnectedAt: disconnected ? now : ws.disconnectedAt,
          guildName: input.guildName,
          guildIcon: input.guildIcon ?? ws.guildIcon,
          guildOwnerDiscordId: input.guildOwnerDiscordId ?? ws.guildOwnerDiscordId,
          updatedAt: now,
        })
        .where(eq(workspaces.id, ws.id))
        .returning()
      ws = updated!
    }
    await tx
      .update(claimTokens)
      .set({ revokedAt: now })
      .where(and(eq(claimTokens.guildId, input.guildId), isNull(claimTokens.claimedAt), isNull(claimTokens.revokedAt)))
    await tx.insert(claimTokens).values({
      id: newId('claimToken'),
      workspaceId: ws.id,
      guildId: input.guildId,
      tokenHash: hashToken(token),
      issuedToDiscordId: input.issuedToDiscordId,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + CLAIM_TOKEN.ttlMs),
    })
    return { token, workspace: ws, disconnected }
  })
}

export type ClaimError =
  | 'invalid_format'
  | 'not_found'
  | 'expired'
  | 'already_used'
  | 'not_allowed'
  | 'purged'

export type ClaimResult =
  | { ok: true; workspace: Workspace; becameOwner: boolean }
  | { ok: false; error: ClaimError }

/**
 * Claim a token on the web. Rules:
 *  - unclaimed workspace  -> claimant becomes Owner, workspace connects
 *  - disconnected workspace -> the Owner, a member with settings rights, or the Discord
 *    guild owner (verified via Discord OAuth) may reconnect; the Discord guild owner
 *    may also take over ownership
 *  - a used, revoked or expired token can never be claimed again
 */
export async function claimToken(
  db: Db,
  input: { token: string; userId: string; allowReconnectByUserIds?: string[] },
): Promise<ClaimResult> {
  const raw = normalizeClaimToken(input.token)
  if (!isClaimTokenShape(raw)) return { ok: false, error: 'invalid_format' }
  const hash = hashToken(raw)
  const row = await db.query.claimTokens.findFirst({ where: eq(claimTokens.tokenHash, hash) })
  if (!row) return { ok: false, error: 'not_found' }
  if (row.claimedAt || row.revokedAt) return { ok: false, error: 'already_used' }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, error: 'expired' }

  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, row.workspaceId) })
  if (!ws) return { ok: false, error: 'not_found' }
  if (ws.status === 'purged' || ws.status === 'purging') return { ok: false, error: 'purged' }

  const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) })
  if (!user) return { ok: false, error: 'not_allowed' }

  const isDiscordGuildOwner = !!user.discordUserId && user.discordUserId === ws.guildOwnerDiscordId
  const isCurrentOwner = ws.ownerUserId === input.userId
  const mayReconnect = input.allowReconnectByUserIds?.includes(input.userId) ?? false

  let becameOwner = false
  if (!ws.ownerUserId) {
    becameOwner = true
  } else if (!isCurrentOwner && !isDiscordGuildOwner && !mayReconnect) {
    return { ok: false, error: 'not_allowed' }
  } else if (isDiscordGuildOwner && !isCurrentOwner) {
    becameOwner = true // Discord guild owner takes over
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(claimTokens)
      .set({ claimedAt: now, claimedByUserId: input.userId })
      .where(and(eq(claimTokens.id, row.id), isNull(claimTokens.claimedAt)))
    await tx
      .update(workspaces)
      .set({ status: 'connected', claimedAt: ws.claimedAt ?? now, disconnectedAt: null, updatedAt: now })
      .where(eq(workspaces.id, ws.id))
  })
  await ensureDefaultRoles(db, ws.id)
  if (becameOwner) await setWorkspaceOwner(db, ws.id, input.userId)
  const fresh = await db.query.workspaces.findFirst({ where: eq(workspaces.id, ws.id) })
  return { ok: true, workspace: fresh!, becameOwner }
}

/** Most recent live (unclaimed, unexpired) token for a guild, if any — for `~status`. */
export async function getLiveTokenMeta(db: Db, guildId: string) {
  return db.query.claimTokens.findFirst({
    where: and(
      eq(claimTokens.guildId, guildId),
      isNull(claimTokens.claimedAt),
      isNull(claimTokens.revokedAt),
      gt(claimTokens.expiresAt, new Date()),
    ),
    columns: { id: true, issuedAt: true, expiresAt: true, issuedToDiscordId: true },
  })
}
