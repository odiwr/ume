import type { Metadata } from 'next'
import { CAP, roleGrantableByEmail, roleGrantableByLink } from '@ume/shared'
import { CreateInviteButtons, type InviteRoleOption } from '@/components/app/invites/invite-create'
import { InviteList, type InviteRow } from '@/components/app/invites/invite-list'
import { PageHeader } from '@/components/app/page-header'
import { displayName } from '@/lib/app/format'
import { listInvites, listRoles } from '@/lib/app/queries'
import { requireWorkspacePage } from '@/lib/app/workspace'
import { appUrl } from '@/lib/utils'

export const metadata: Metadata = { title: 'Invites', robots: { index: false } }

export default async function InvitesPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const { workspace, access } = await requireWorkspacePage(umeId, CAP.MANAGE_INVITES)
  const [invites, roles] = await Promise.all([listInvites(workspace.id), listRoles(workspace.id)])

  const roleOptions: InviteRoleOption[] = roles
    .filter((r) => r.systemKey !== 'owner')
    .map((r) => ({
      id: r.id,
      name: r.name,
      byLink: roleGrantableByLink(r.capabilities),
      byEmail: roleGrantableByEmail(r.capabilities),
      grantable: access.isOwner || (r.capabilities & ~access.caps) === 0,
    }))

  const rows: InviteRow[] = invites.map((inv) => ({
    id: inv.id,
    kind: inv.kind,
    url: appUrl(`/invite/${inv.token}`),
    email: inv.email,
    label: inv.label,
    roleName: inv.role.name,
    uses: inv.uses,
    maxUses: inv.maxUses,
    expiresAt: inv.expiresAt.toISOString(),
    membershipExpiresAt: inv.membershipExpiresAt ? inv.membershipExpiresAt.toISOString() : null,
    requireGuildMember: inv.requireGuildMember,
    revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
    emailSentAt: inv.emailSentAt ? inv.emailSentAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    createdBy: displayName(inv.createdBy),
  }))

  return (
    <>
      <PageHeader
        title="Invites"
        actions={<CreateInviteButtons workspaceId={workspace.id} roles={roleOptions} />}
      />
      <InviteList workspaceId={workspace.id} rows={rows} />
    </>
  )
}
