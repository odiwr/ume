import type { Metadata } from 'next'
import Link from 'next/link'
import { formatBytes } from '@ume/shared'
import { clampPage, listWorkspaces, str, WORKSPACE_STATUSES, classifyBot } from '@/lib/ceo/queries'
import { PageHeader, FilterChips } from '@/components/ceo/page-header'
import { SearchForm } from '@/components/ceo/search-form'
import { DataTable, Mono, type Column } from '@/components/ceo/data-table'
import { Pagination } from '@/components/ceo/pagination'
import { BotHealthBadge, PlanBadge, WorkspaceStatusBadge } from '@/components/ceo/status-badge'
import { Ago } from '@/components/ceo/time'
import type { WorkspaceRow } from '@/lib/ceo/queries'

export const metadata: Metadata = { title: 'Workspaces' }

export default async function CeoWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const q = str(sp.q)
  const status = str(sp.status) || undefined
  const page = clampPage(sp.page)
  const result = await listWorkspaces({ q, status, page })

  const columns: Column<WorkspaceRow>[] = [
    {
      key: 'name',
      header: 'Workspace',
      render: (r) => (
        <div className="min-w-0">
          <Link
            href={`/ceo/workspaces/${r.ws.id}`}
            className="font-medium text-fg hover:text-pink-soft"
          >
            {r.ws.guildName}
          </Link>
          <div className="mt-0.5">
            <Mono>{r.ws.umeId}</Mono>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <WorkspaceStatusBadge status={r.ws.status} />,
    },
    { key: 'plan', header: 'Plan', render: (r) => <PlanBadge plan={r.ws.plan} /> },
    {
      key: 'owner',
      header: 'Owner',
      render: (r) =>
        r.ws.ownerUserId ? (
          <Link href={`/ceo/users/${r.ws.ownerUserId}`} className="text-fg-muted hover:text-fg">
            {r.ownerEmail ?? r.ws.ownerUserId}
          </Link>
        ) : (
          <span className="text-fg-subtle">unclaimed</span>
        ),
    },
    {
      key: 'storage',
      header: 'Storage',
      align: 'right',
      render: (r) => formatBytes(r.ws.storageUsedBytes),
    },
    {
      key: 'tracks',
      header: 'Tracks',
      align: 'right',
      render: (r) => r.ws.trackCount.toLocaleString('en-US'),
    },
    { key: 'bot', header: 'Bot', render: (r) => <BotHealthBadge health={classifyBot(r.ws)} /> },
    { key: 'activity', header: 'Last activity', render: (r) => <Ago date={r.ws.lastActivityAt} /> },
    { key: 'created', header: 'Created', render: (r) => <Ago date={r.ws.createdAt} /> },
  ]

  return (
    <>
      <PageHeader title="Workspaces" />
      <div className="flex flex-col gap-3">
        <SearchForm
          basePath="/ceo/workspaces"
          q={q}
          placeholder="Search name, ume-…, guild id, owner email"
          hidden={{ status }}
        />
        <FilterChips
          basePath="/ceo/workspaces"
          current={status ?? null}
          extra={{ q }}
          options={[
            { value: null, label: 'All' },
            ...WORKSPACE_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.ws.id}
        empty="No workspaces match."
      />
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/ceo/workspaces"
        params={{ q, status }}
      />
    </>
  )
}
