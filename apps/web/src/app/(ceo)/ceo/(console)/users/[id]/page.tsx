import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatBytes, userAvatarUrl } from '@ume/shared'
import { getUserDetail } from '@/lib/ceo/queries'
import { requireCeo } from '@/lib/session'
import { PageHeader, KeyValue, Section } from '@/components/ceo/page-header'
import { DataTable, Mono, type Column } from '@/components/ceo/data-table'
import { PlanBadge, WorkspaceStatusBadge } from '@/components/ceo/status-badge'
import { Ago, Absolute } from '@/components/ceo/time'
import { UserBanControl } from '@/components/ceo/user-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const d = await getUserDetail(id)
  return { title: d ? d.user.email : 'User' }
}

type Detail = NonNullable<Awaited<ReturnType<typeof getUserDetail>>>
type MembershipRow = Detail['memberships'][number]
type OwnedRow = Detail['owned'][number]
type AuditRow = Detail['recentAudit'][number]

export default async function CeoUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCeo()
  const { id } = await params
  const d = await getUserDetail(id)
  if (!d) notFound()
  const { user } = d
  const avatar = user.discordUserId
    ? userAvatarUrl(user.discordUserId, user.discordAvatar, 64)
    : user.image

  const membershipColumns: Column<MembershipRow>[] = [
    {
      key: 'ws',
      header: 'Workspace',
      render: (m) => (
        <div>
          <Link
            href={`/ceo/workspaces/${m.workspace.id}`}
            className="font-medium hover:text-pink-soft"
          >
            {m.workspace.guildName}
          </Link>
          <div className="mt-0.5 flex items-center gap-2">
            <Mono>{m.workspace.umeId}</Mono>
            <WorkspaceStatusBadge status={m.workspace.status} />
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (m) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: m.role.color }} />
          {m.role.name}
        </span>
      ),
    },
    { key: 'source', header: 'Source', render: (m) => <Badge>{m.source.replace('_', ' ')}</Badge> },
    {
      key: 'expires',
      header: 'Expires',
      render: (m) =>
        m.expiresAt ? <Ago date={m.expiresAt} /> : <span className="text-fg-subtle">never</span>,
    },
    { key: 'since', header: 'Since', render: (m) => <Ago date={m.createdAt} /> },
  ]

  const ownedColumns: Column<OwnedRow>[] = [
    {
      key: 'ws',
      header: 'Workspace',
      render: (w) => (
        <Link href={`/ceo/workspaces/${w.id}`} className="font-medium hover:text-pink-soft">
          {w.guildName}
        </Link>
      ),
    },
    { key: 'status', header: 'Status', render: (w) => <WorkspaceStatusBadge status={w.status} /> },
    { key: 'plan', header: 'Plan', render: (w) => <PlanBadge plan={w.plan} /> },
    {
      key: 'storage',
      header: 'Storage',
      align: 'right',
      render: (w) => formatBytes(w.storageUsedBytes),
    },
    { key: 'created', header: 'Created', render: (w) => <Ago date={w.createdAt} /> },
  ]

  const auditColumns: Column<AuditRow>[] = [
    { key: 'when', header: 'When', render: (a) => <Ago date={a.createdAt} /> },
    { key: 'action', header: 'Action', render: (a) => <Mono>{a.action}</Mono> },
    {
      key: 'ws',
      header: 'Workspace',
      render: (a) =>
        a.workspace ? (
          <Link href={`/ceo/workspaces/${a.workspace.id}`} className="hover:text-pink-soft">
            {a.workspace.guildName}
          </Link>
        ) : (
          <span className="text-fg-subtle">global</span>
        ),
    },
    {
      key: 'target',
      header: 'Target',
      render: (a) =>
        a.targetType ? (
          <span className="text-xs text-fg-muted">
            {a.targetType} {a.targetId}
          </span>
        ) : (
          ''
        ),
    },
  ]

  return (
    <>
      <PageHeader
        back={{ href: '/ceo/users', label: 'Users' }}
        title={
          <span className="inline-flex items-center gap-3">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                width={40}
                height={40}
                className="size-10 rounded-full border border-border"
              />
            ) : (
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface-3 font-display text-lg">
                {(user.name || user.email).slice(0, 1).toUpperCase()}
              </span>
            )}
            {user.name || user.email}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {user.email}
            {user.banned ? (
              <Badge tone="danger">banned</Badge>
            ) : (
              <Badge tone="success">active</Badge>
            )}
            {d.providers.map((p) => (
              <Badge key={p.providerId} tone={p.providerId === 'discord' ? 'sage' : 'beige'}>
                {p.providerId}
              </Badge>
            ))}
          </span>
        }
      />

      <Section title="Account">
        <Card>
          <CardContent>
            <KeyValue
              items={[
                { label: 'User id', value: <Mono>{user.id}</Mono> },
                { label: 'Email verified', value: user.emailVerified ? 'yes' : 'no' },
                {
                  label: 'Discord id',
                  value: user.discordUserId ? <Mono>{user.discordUserId}</Mono> : 'not linked',
                },
                {
                  label: 'Discord username',
                  value: user.discordUsername ? `@${user.discordUsername}` : null,
                },
                { label: 'Joined', value: <Absolute date={user.createdAt} /> },
                { label: 'Updated', value: <Absolute date={user.updatedAt} /> },
                { label: 'Ban reason', value: user.banReason },
              ]}
            />
          </CardContent>
        </Card>
      </Section>

      <Section title="Moderation">
        <Card className={user.banned ? 'border-danger/30' : undefined}>
          <CardHeader>
            <CardTitle>{user.banned ? 'This user is banned' : 'Ban this user'}</CardTitle>
            <CardDescription>
              {user.banned
                ? 'They cannot sign in. Their memberships and ownership are kept so the ban can be lifted cleanly.'
                : 'Signs them out everywhere and blocks sign-in. Their data stays; workspaces they own keep working for other members.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserBanControl
              userId={user.id}
              email={user.email}
              banned={user.banned}
              banReason={user.banReason}
              isSelf={user.id === session.user.id}
            />
          </CardContent>
        </Card>
      </Section>

      <Section title={`Owns (${d.owned.length})`}>
        <DataTable
          columns={ownedColumns}
          rows={d.owned}
          rowKey={(w) => w.id}
          empty="Does not own a workspace."
          dense
        />
      </Section>

      <Section title={`Memberships (${d.memberships.length})`}>
        <DataTable
          columns={membershipColumns}
          rows={d.memberships}
          rowKey={(m) => m.id}
          empty="No memberships."
          dense
        />
      </Section>

      <Section title="Recent actions" description="Audit entries where this user is the actor.">
        <DataTable
          columns={auditColumns}
          rows={d.recentAudit}
          rowKey={(a) => a.id}
          empty="No audit entries."
          dense
        />
      </Section>
    </>
  )
}
