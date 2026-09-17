'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { invites, logAudit, memberships, roles, workspaces } from '@ume/db'
import {
  CAP,
  emailSchema,
  generateInviteToken,
  inviteCreateSchema,
  newId,
  roleGrantableByEmail,
  roleGrantableByLink,
} from '@ume/shared'
import { EMAIL_NOT_CONFIGURED, inviteEmail, sendEmail } from '@ume/email'
import { db } from '@/lib/db'
import { getGuildMember } from '@/lib/discord-api'
import { requireUser } from '@/lib/session'
import { appUrl } from '@/lib/utils'
import { AppError, guard, runAction, type ActionResult, type Guarded } from '@/lib/app/guard'
import { workspacePath } from '@/lib/app/nav'

const INVITE_MAX_USES = 10_000

function assertGrantable(g: Guarded, caps: number): void {
  if (g.access.isOwner) return
  if ((caps & ~g.access.caps) !== 0)
    throw new AppError('You cannot invite people to a role with permissions you do not have.')
}

async function loadInviteRole(g: Guarded, roleId: string) {
  const role = await db.query.roles.findFirst({
    where: and(eq(roles.id, roleId), eq(roles.workspaceId, g.workspace.id)),
  })
  if (!role) throw new AppError('That role does not exist.')
  if (role.systemKey === 'owner') throw new AppError('Nobody can be invited as Owner.')
  assertGrantable(g, role.capabilities)
  return role
}

export interface CreateInviteInput {
  roleId: string
  expiresInDays: number
  maxUses: number | null
  membershipExpiresAt: string | null
  requireGuildMember: boolean
  label?: string | null
  email?: string
}

export async function createLinkInvite(
  workspaceId: string,
  input: CreateInviteInput,
): Promise<ActionResult<{ url: string; inviteId: string }>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_INVITES)
    const data = inviteCreateSchema.parse({
      ...input,
      kind: 'link',
      membershipExpiresAt: input.membershipExpiresAt || null,
    })
    if (data.maxUses !== null && data.maxUses > INVITE_MAX_USES)
      throw new AppError('That is too many uses.')
    const role = await loadInviteRole(g, data.roleId)
    if (!roleGrantableByLink(role.capabilities)) {
      throw new AppError(
        `"${role.name}" can delete or manage things, so it can only be granted by email invite. Share links are limited to contributor roles.`,
      )
    }
    const token = generateInviteToken()
    const [row] = await db
      .insert(invites)
      .values({
        id: newId('invite'),
        workspaceId,
        kind: 'link',
        token,
        roleId: role.id,
        label: input.label?.trim() || null,
        maxUses: data.maxUses,
        expiresAt: new Date(Date.now() + data.expiresInDays * 86_400_000),
        membershipExpiresAt: data.membershipExpiresAt,
        requireGuildMember: data.requireGuildMember,
        createdByUserId: g.user.id,
      })
      .returning({ id: invites.id })
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      action: 'invite.create',
      targetType: 'invite',
      targetId: row!.id,
      metadata: {
        kind: 'link',
        roleId: role.id,
        maxUses: data.maxUses,
        expiresInDays: data.expiresInDays,
      },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return { url: appUrl(`/invite/${token}`), inviteId: row!.id }
  })
}

export interface EmailInviteResult {
  inviteId: string
  /** True only when the sender accepted the message (or dry-ran it outside production). */
  sent: boolean
  /** Why it was not sent, so the UI can say what to do next. */
  sendError?: 'not_configured' | 'failed'
  /** The invite link, so the inviter can hand it over another way when email is down. */
  url: string
}

export async function createEmailInvite(
  workspaceId: string,
  input: CreateInviteInput,
): Promise<ActionResult<EmailInviteResult>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_INVITES)
    const email = emailSchema.parse(input.email ?? '')
    const data = inviteCreateSchema.parse({
      ...input,
      kind: 'email',
      email,
      maxUses: 1,
      membershipExpiresAt: input.membershipExpiresAt || null,
    })
    const role = await loadInviteRole(g, data.roleId)
    if (!roleGrantableByEmail(role.capabilities))
      throw new AppError('That role cannot be granted by invite.')
    const token = generateInviteToken()
    const expiresAt = new Date(Date.now() + data.expiresInDays * 86_400_000)
    const [row] = await db
      .insert(invites)
      .values({
        id: newId('invite'),
        workspaceId,
        kind: 'email',
        token,
        email,
        roleId: role.id,
        label: input.label?.trim() || null,
        maxUses: 1,
        expiresAt,
        membershipExpiresAt: data.membershipExpiresAt,
        requireGuildMember: data.requireGuildMember,
        createdByUserId: g.user.id,
      })
      .returning({ id: invites.id })
    const url = appUrl(`/invite/${token}`)
    const message = inviteEmail({
      to: email,
      serverName: g.workspace.guildName,
      roleName: role.name,
      inviterName: g.user.name || g.user.discordUsername || 'A member',
      url,
      expiresAt,
    })
    // A thrown error (network, Resend outage) counts as not sent; the invite row still exists.
    const sent = await sendEmail(message).catch((err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : 'send failed',
    }))
    // Only a real acceptance (or a dev dry-run) stamps emailSentAt; "Emailed" in the list means exactly that.
    if (sent.ok)
      await db.update(invites).set({ emailSentAt: new Date() }).where(eq(invites.id, row!.id))
    else console.warn(`[invites] email invite ${row!.id} not sent: ${sent.error}`)
    const sendError: EmailInviteResult['sendError'] = sent.ok
      ? undefined
      : sent.error === EMAIL_NOT_CONFIGURED
        ? 'not_configured'
        : 'failed'
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      action: 'invite.create',
      targetType: 'invite',
      targetId: row!.id,
      metadata: {
        kind: 'email',
        roleId: role.id,
        email,
        sent: sent.ok,
        ...(sendError ? { sendError } : {}),
      },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return { inviteId: row!.id, sent: sent.ok, ...(sendError ? { sendError } : {}), url }
  })
}

export async function revokeInvite(
  workspaceId: string,
  inviteId: string,
  removeMembers: boolean,
): Promise<ActionResult<{ removed: number }>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_INVITES)
    const invite = await db.query.invites.findFirst({
      where: and(eq(invites.id, inviteId), eq(invites.workspaceId, workspaceId)),
    })
    if (!invite) throw new AppError('That invite does not exist.')
    if (!invite.revokedAt) {
      await db.update(invites).set({ revokedAt: new Date() }).where(eq(invites.id, invite.id))
    }
    let removed = 0
    if (removeMembers) {
      const where = g.workspace.ownerUserId
        ? and(
            eq(memberships.workspaceId, workspaceId),
            eq(memberships.inviteId, invite.id),
            ne(memberships.userId, g.workspace.ownerUserId),
          )
        : and(eq(memberships.workspaceId, workspaceId), eq(memberships.inviteId, invite.id))
      const rows = await db.delete(memberships).where(where).returning({ id: memberships.id })
      removed = rows.length
    }
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      action: 'invite.revoke',
      targetType: 'invite',
      targetId: invite.id,
      metadata: { removedMembers: removed },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return { removed }
  })
}

/** Public: accept an invite link or email invite. Redirects into the workspace on success. */
export async function acceptInvite(token: string): Promise<ActionResult<string>> {
  const safeToken = z
    .string()
    .regex(/^[a-z2-7]{16,64}$/)
    .safeParse(token)
  const result = await runAction(async () => {
    if (!safeToken.success) throw new AppError('This invite is no longer valid.')
    const session = await requireUser(`/invite/${safeToken.data}`)
    const me = session.user
    const invite = await db.query.invites.findFirst({
      where: eq(invites.token, safeToken.data),
      with: { role: true, workspace: true },
    })
    const now = Date.now()
    if (
      !invite ||
      invite.revokedAt ||
      invite.expiresAt.getTime() < now ||
      (invite.maxUses !== null && invite.uses >= invite.maxUses) ||
      invite.workspace.status === 'purged' ||
      invite.workspace.status === 'purging'
    ) {
      throw new AppError('This invite is no longer valid.')
    }
    if (invite.kind === 'email') {
      if (!me.email || me.email.toLowerCase() !== (invite.email ?? '').toLowerCase()) {
        throw new AppError(
          `This invite was sent to a different email address. Sign in with the account that received it.`,
        )
      }
      if (!me.emailVerified)
        throw new AppError(
          'Verify your email address with your sign-in provider before accepting this invite.',
        )
    }
    if (invite.requireGuildMember) {
      if (!me.discordUserId)
        throw new AppError('This invite requires Discord. Link your Discord account and try again.')
      const member = await getGuildMember(invite.workspace.guildId, me.discordUserId).catch(
        () => null,
      )
      if (!member)
        throw new AppError(
          `You need to be a member of the "${invite.workspace.guildName}" Discord server to accept this invite.`,
        )
    }

    const existing = await db.query.memberships.findFirst({
      where: and(eq(memberships.workspaceId, invite.workspaceId), eq(memberships.userId, me.id)),
      with: { role: true },
    })
    const source = invite.kind === 'email' ? 'email_invite' : 'invite_link'
    if (existing) {
      // Never downgrade someone who already holds a higher-positioned role (or the Owner).
      const keepRole =
        existing.role.systemKey === 'owner' || existing.role.position < invite.role.position
      await db
        .update(memberships)
        .set({
          roleId: keepRole ? existing.roleId : invite.roleId,
          source: keepRole ? existing.source : source,
          inviteId: invite.id,
          expiresAt: keepRole ? existing.expiresAt : invite.membershipExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(memberships.id, existing.id))
    } else {
      await db.insert(memberships).values({
        id: newId('membership'),
        workspaceId: invite.workspaceId,
        userId: me.id,
        roleId: invite.roleId,
        source,
        inviteId: invite.id,
        expiresAt: invite.membershipExpiresAt,
      })
    }
    await db
      .update(invites)
      .set({ uses: sql`${invites.uses} + 1`, lastUsedAt: new Date() })
      .where(eq(invites.id, invite.id))
    await logAudit(db, {
      workspaceId: invite.workspaceId,
      actorUserId: me.id,
      actorDiscordId: me.discordUserId ?? null,
      action: 'invite.accept',
      targetType: 'invite',
      targetId: invite.id,
      metadata: { kind: invite.kind, roleId: invite.roleId },
    })
    // Keep the guild name fresh for the workspace row we just joined.
    await db
      .update(workspaces)
      .set({ updatedAt: new Date() })
      .where(eq(workspaces.id, invite.workspaceId))
    revalidatePath('/app', 'layout')
    return invite.workspace.umeId
  })
  if (result.ok) redirect(`/app/${result.data}`)
  return result
}
