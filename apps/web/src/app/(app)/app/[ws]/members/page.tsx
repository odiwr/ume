import type { Metadata } from 'next'
import Link from 'next/link'
import { Ticket } from '@/components/ui/icons'
import { can } from '@ume/db'
import { CAP } from '@ume/shared'
import { buttonClasses } from '@/components/ui/button'
import { MemberTable, type MemberRow, type RoleOption } from '@/components/app/members/member-table'
import { RoleMapEditor, type DiscordRoleRow } from '@/components/app/members/role-map-editor'
import { PageHeader, Section } from '@/components/app/page-header'
import { discordRoleColor, getGuildRoles } from '@/lib/discord-api'
import { listMembers, listRoleMaps, listRoles } from '@/lib/app/queries'
import { requireWorkspacePage } from '@/lib/app/workspace'

export const metadata: Metadata = { title: 'Members', robots: { index: false } }

export default async function MembersPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const { workspace, access, user } = await requireWorkspacePage(umeId, CAP.MANAGE_MEMBERS)
  const [members, roles, maps] = await Promise.all([
    listMembers(workspace.id),
    listRoles(workspace.id),
    listRoleMaps(workspace.id),
  ])

  const grantable = (caps: number) => access.isOwner || (caps & ~access.caps) === 0
  const roleOptions: RoleOption[] = roles
    .filter((r) => r.systemKey !== 'owner')
    .map((r) => ({ id: r.id, name: r.name, color: r.color, grantable: grantable(r.capabilities) }))
  const rows: MemberRow[] = members.map((m) => {
    const isOwner = m.userId === workspace.ownerUserId || m.role.systemKey === 'owner'
    return {
      membershipId: m.id,
      userId: m.userId,
      user: m.user,
      roleId: m.roleId,
      roleName: m.role.name,
      roleColor: m.role.color,
      isOwner,
      source: m.source,
      expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
      editable: !isOwner && m.userId !== user.id && grantable(m.role.capabilities),
    }
  })

  const canMap = can(access, CAP.MANAGE_SETTINGS)
  let discordRoles: DiscordRoleRow[] = []
  let loadError: string | null = null
  if (canMap) {
    try {
      const fetched = await getGuildRoles(workspace.guildId)
      const mappedBy = new Map(maps.map((m) => [m.discordRoleId, m.roleId]))
      discordRoles = fetched.map((r) => ({
        id: r.id,
        name: r.name,
        color: discordRoleColor(r.color),
        managed: r.managed,
        isEveryone: r.id === workspace.guildId,
        mappedRoleId: mappedBy.get(r.id) ?? null,
      }))
      if (!fetched.length)
        loadError =
          'Ume cannot read this server’s roles. Make sure the bot is in the server, then reload.'
    } catch {
      loadError = 'Could not reach Discord to list roles. Try again in a moment.'
    }
  }

  return (
    <>
      <PageHeader
        title="Members"
        actions={
          can(access, CAP.MANAGE_INVITES) ? (
            <Link href={`/app/${umeId}/invites`} className={buttonClasses('primary', 'md')}>
              <Ticket className="size-4" /> Invite someone
            </Link>
          ) : null
        }
      />
      <MemberTable workspaceId={workspace.id} rows={rows} roles={roleOptions} meUserId={user.id} />

      {canMap ? (
        <Section id="discord-roles" title="Discord role mapping">
          <RoleMapEditor
            workspaceId={workspace.id}
            discordRoles={discordRoles}
            roles={roleOptions}
            defaultRoleId={workspace.defaultRoleId}
            syncEnabled={workspace.discordRoleSyncEnabled}
            loadError={loadError}
          />
        </Section>
      ) : null}
    </>
  )
}
