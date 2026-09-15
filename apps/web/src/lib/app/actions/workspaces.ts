'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import {
  playlists,
  can,
  claimToken,
  claimTokens,
  ensureDefaultRoles,
  getAccess,
  getWorkspaceByGuildId,
  logAudit,
  memberships,
  setWorkspaceOwner,
  workspaces,
  type ClaimError,
} from '@ume/db'
import { CAP, canClaimGuild, hashToken, isClaimTokenShape, newId, newUmeId, normalizeClaimToken, slugify } from '@ume/shared'
import { db } from '@/lib/db'
import { fetchUserGuilds, getGuild, getGuildMember } from '@/lib/discord-api'
import { getDiscordAccessToken, requireUser } from '@/lib/session'
import { AppError, runAction, type ActionResult } from '@/lib/app/guard'
import { resolveRoleForDiscordMember } from '@/lib/app/workspace'

const guildIdSchema = z.string().regex(/^\d{5,25}$/, 'That is not a Discord server id.')

async function ensureDefaultPlaylist(workspaceId: string, userId: string): Promise<void> {
  const existing = await db.query.playlists.findFirst({ where: eq(playlists.workspaceId, workspaceId), columns: { id: true } })
  if (existing) return
  await db
    .insert(playlists)
    .values({ id: newId('playlist'), workspaceId, name: 'Main', slug: slugify('Main'), createdByUserId: userId })
    .onConflictDoNothing()
}

/** Records the rights attestation the first time an Owner accepts it (never overwritten). */
async function recordAttestation(workspaceId: string, userId: string): Promise<void> {
  const now = new Date()
  await db
    .update(workspaces)
    .set({ linkExtractAcceptedAt: now, linkExtractAcceptedByUserId: userId, updatedAt: now })
    .where(and(eq(workspaces.id, workspaceId), isNull(workspaces.linkExtractAcceptedAt)))
}

/**
 * Claim (or reconnect) a server through Discord OAuth. Re-fetches the user's guilds
 * server-side so the owner/Administrator check can never be spoofed by the client.
 */
export async function claimGuildViaOAuth(guildId: string, attestationAccepted: boolean): Promise<ActionResult<string>> {
  const result = await runAction(async () => {
    const session = await requireUser('/app/new')
    const me = session.user
    const id = guildIdSchema.parse(guildId)
    if (!attestationAccepted) throw new AppError('Confirm that you will only add music you have the right to play in your server.')
    if (!me.discordUserId) throw new AppError('Link your Discord account first.')
    const token = await getDiscordAccessToken()
    if (!token) throw new AppError('Your Discord session expired. Sign in with Discord again.')
    const guilds = await fetchUserGuilds(token)
    const guild = guilds.find((g) => g.id === id)
    if (!guild) throw new AppError('You are not a member of that server any more.')
    if (!canClaimGuild(guild)) throw new AppError('Only the server owner or an Administrator can claim a server.')

    const now = new Date()
    let ws = await getWorkspaceByGuildId(db, id)
    const botGuild = await getGuild(id).catch(() => null)

    if (!ws) {
      const [created] = await db
        .insert(workspaces)
        .values({
          id: newId('workspace'),
          umeId: newUmeId(),
          guildId: id,
          guildName: guild.name,
          guildIcon: guild.icon,
          guildOwnerDiscordId: guild.owner ? me.discordUserId : (botGuild?.owner_id ?? null),
          status: 'connected',
          claimedAt: now,
          botInGuild: !!botGuild,
        })
        .returning()
      ws = created!
    } else {
      if (ws.status === 'purged' || ws.status === 'purging') {
        throw new AppError('This server was purged. Wait for the purge to finish, then run /reload in Discord.')
      }
      const isCurrentOwner = ws.ownerUserId === me.id
      if (ws.ownerUserId && !isCurrentOwner && !guild.owner) {
        throw new AppError('This server is already claimed by someone else. Ask them for an invite, or join from the server picker.')
      }
      const [updated] = await db
        .update(workspaces)
        .set({
          status: 'connected',
          claimedAt: ws.claimedAt ?? now,
          disconnectedAt: null,
          guildName: guild.name,
          guildIcon: guild.icon,
          guildOwnerDiscordId: guild.owner ? me.discordUserId : (ws.guildOwnerDiscordId ?? botGuild?.owner_id ?? null),
          botInGuild: botGuild ? true : ws.botInGuild,
          updatedAt: now,
        })
        .where(eq(workspaces.id, ws.id))
        .returning()
      ws = updated!
    }

    await ensureDefaultRoles(db, ws.id)
    const becameOwner = !ws.ownerUserId || ws.ownerUserId === me.id || guild.owner
    if (becameOwner) await setWorkspaceOwner(db, ws.id, me.id)
    await ensureDefaultPlaylist(ws.id, me.id)
    if (becameOwner) await recordAttestation(ws.id, me.id)
    await logAudit(db, {
      workspaceId: ws.id,
      actorUserId: me.id,
      actorDiscordId: me.discordUserId,
      action: ws.claimedAt && ws.claimedAt < now ? 'workspace.reconnect' : 'workspace.claim',
      targetType: 'workspace',
      targetId: ws.id,
      metadata: { via: 'oauth', guildId: id, becameOwner, attestationAccepted: true },
    })
    revalidatePath('/app', 'layout')
    return ws.umeId
  })
  if (result.ok) redirect(`/app/${result.data}`)
  return result
}

/** Join a connected workspace as a plain Discord member (role mapping or default role). */
export async function joinWorkspaceViaOAuth(guildId: string): Promise<ActionResult<string>> {
  const result = await runAction(async () => {
    const session = await requireUser('/app/new')
    const me = session.user
    const id = guildIdSchema.parse(guildId)
    if (!me.discordUserId) throw new AppError('Link your Discord account first.')
    const token = await getDiscordAccessToken()
    if (!token) throw new AppError('Your Discord session expired. Sign in with Discord again.')
    const guilds = await fetchUserGuilds(token)
    if (!guilds.some((g) => g.id === id)) throw new AppError('You are not a member of that server.')
    const ws = await getWorkspaceByGuildId(db, id)
    if (!ws || ws.status === 'purged' || ws.status === 'purging') throw new AppError('That server has no Ume workspace.')
    if (ws.status !== 'connected') throw new AppError('That workspace is disconnected. Ask the owner to reconnect it first.')
    const access = await getAccess(db, ws.id, me.id)
    if (access?.membership) return ws.umeId
    const member = await getGuildMember(ws.guildId, me.discordUserId).catch(() => null)
    const resolved = await resolveRoleForDiscordMember(ws, member?.roles ?? [])
    if (!resolved) throw new AppError('This server does not grant access automatically. Ask the owner for an invite link.')
    await db
      .insert(memberships)
      .values({ id: newId('membership'), workspaceId: ws.id, userId: me.id, roleId: resolved.roleId, source: resolved.source })
      .onConflictDoNothing()
    revalidatePath('/app', 'layout')
    return ws.umeId
  })
  if (result.ok) redirect(`/app/${result.data}`)
  return result
}

const CLAIM_ERRORS: Record<ClaimError, string> = {
  invalid_format: 'That does not look like an Ume token. It starts with "ume_" and is 44 characters long.',
  not_found: 'We could not find that token. Run /reload in Discord to get a fresh one.',
  expired: 'That token expired. Run /reload in Discord to get a fresh one.',
  already_used: 'That token was already used or replaced by a newer /reload. Run /reload again.',
  not_allowed: 'Only the workspace Owner, the Discord server owner, or a member with settings rights can reconnect this server.',
  purged: 'This server was purged. Run /reload again once the purge has finished.',
}

export interface ClaimTokenState {
  error?: string
}

/** Form action for /app/claim and the Settings "Enter a new token" form. Never logs the token. */
export async function submitClaimToken(_prev: ClaimTokenState, formData: FormData): Promise<ClaimTokenState> {
  const session = await requireUser('/app/claim')
  const raw = String(formData.get('token') ?? '')
  const returnTo = String(formData.get('returnTo') ?? '')
  const attestation = formData.get('attestation') === 'on'
  const normalized = normalizeClaimToken(raw)
  if (!isClaimTokenShape(normalized)) return { error: CLAIM_ERRORS.invalid_format }
  if (!attestation) return { error: 'Confirm that you will only add music you have the right to play in your server.' }

  // Decide whether this user may *reconnect* (they already have settings rights).
  const allowReconnectByUserIds: string[] = []
  const row = await db.query.claimTokens.findFirst({
    where: eq(claimTokens.tokenHash, hashToken(normalized)),
    columns: { workspaceId: true },
  })
  if (row) {
    const access = await getAccess(db, row.workspaceId, session.user.id)
    if (can(access, CAP.MANAGE_SETTINGS)) allowReconnectByUserIds.push(session.user.id)
  }

  const result = await claimToken(db, { token: normalized, userId: session.user.id, allowReconnectByUserIds })
  if (!result.ok) return { error: CLAIM_ERRORS[result.error] }

  await ensureDefaultPlaylist(result.workspace.id, session.user.id)
  if (result.becameOwner || result.workspace.ownerUserId === session.user.id) {
    await recordAttestation(result.workspace.id, session.user.id)
  }
  await logAudit(db, {
    workspaceId: result.workspace.id,
    actorUserId: session.user.id,
    actorDiscordId: session.user.discordUserId ?? null,
    action: result.becameOwner ? 'workspace.claim' : 'workspace.reconnect',
    targetType: 'workspace',
    targetId: result.workspace.id,
    metadata: { via: 'token', becameOwner: result.becameOwner, attestationAccepted: true },
  })
  revalidatePath('/app', 'layout')
  redirect(returnTo.startsWith('/app/') && !returnTo.startsWith('//') ? returnTo : `/app/${result.workspace.umeId}`)
}
