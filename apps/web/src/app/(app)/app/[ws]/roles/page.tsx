import type { Metadata } from 'next'
import { CAP } from '@ume/shared'
import { PageHeader } from '@/components/app/page-header'
import { RoleEditor, type EditableRole } from '@/components/app/roles/role-editor'
import { listMembers, listRoles } from '@/lib/app/queries'
import { requireWorkspacePage } from '@/lib/app/workspace'

export const metadata: Metadata = { title: 'Roles', robots: { index: false } }

export default async function RolesPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const { workspace, access } = await requireWorkspacePage(umeId, CAP.MANAGE_ROLES)
  const [roles, members] = await Promise.all([listRoles(workspace.id), listMembers(workspace.id)])
  const counts = new Map<string, number>()
  for (const m of members) counts.set(m.roleId, (counts.get(m.roleId) ?? 0) + 1)
  const rows: EditableRole[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    capabilities: r.capabilities,
    systemKey: r.systemKey,
    memberCount: counts.get(r.id) ?? 0,
  }))

  return (
    <>
      <PageHeader
        title="Roles"
        description="Set permissions for each role. Built-in roles can be renamed but not deleted."
      />
      <RoleEditor
        workspaceId={workspace.id}
        roles={rows}
        viewerCaps={access.caps}
        viewerIsOwner={access.isOwner}
        viewerRoleId={access.role?.id ?? null}
      />
    </>
  )
}
