import 'server-only'
import { eq } from 'drizzle-orm'
import { invites } from '@ume/db'
import { guildIconUrl } from '@ume/shared'
import { db } from '@/lib/db'
import { displayName } from '@/lib/app/format'

/**
 * Why an invite cannot be accepted, for the confirmation page only. `acceptInvite()`
 * re-checks everything server-side; this exists so the page can explain the state
 * before the user clicks.
 */
export type InviteProblem = 'invalid' | 'expired' | 'revoked' | 'used_up'

export type InvitePreview =
  | { ok: false; problem: InviteProblem }
  | {
      ok: true
      kind: 'link' | 'email'
      /** Only set for email invites: the address the invite is bound to. */
      email: string | null
      serverName: string
      iconUrl: string | null
      roleName: string
      inviterName: string
      expiresAt: Date
      membershipExpiresAt: Date | null
      requireGuildMember: boolean
    }

/** Same shape rule as acceptInvite(); anything else never touches the database. */
const TOKEN_SHAPE = /^[a-z2-7]{16,64}$/

/** Read-only lookup of an invite by its token, scoped to what the accept page shows. */
export async function getInvitePreview(token: string): Promise<InvitePreview> {
  if (!TOKEN_SHAPE.test(token)) return { ok: false, problem: 'invalid' }
  const invite = await db.query.invites.findFirst({
    where: eq(invites.token, token),
    with: {
      role: { columns: { name: true } },
      workspace: { columns: { guildId: true, guildName: true, guildIcon: true, status: true } },
      createdBy: { columns: { name: true, discordUsername: true } },
    },
  })
  if (!invite || invite.workspace.status === 'purged' || invite.workspace.status === 'purging') {
    return { ok: false, problem: 'invalid' }
  }
  if (invite.revokedAt) return { ok: false, problem: 'revoked' }
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, problem: 'expired' }
  if (invite.maxUses !== null && invite.uses >= invite.maxUses)
    return { ok: false, problem: 'used_up' }
  return {
    ok: true,
    kind: invite.kind,
    email: invite.kind === 'email' ? invite.email : null,
    serverName: invite.workspace.guildName,
    iconUrl: guildIconUrl(invite.workspace.guildId, invite.workspace.guildIcon, 96),
    roleName: invite.role.name,
    inviterName: displayName(invite.createdBy),
    expiresAt: invite.expiresAt,
    membershipExpiresAt: invite.membershipExpiresAt,
    requireGuildMember: invite.requireGuildMember,
  }
}
