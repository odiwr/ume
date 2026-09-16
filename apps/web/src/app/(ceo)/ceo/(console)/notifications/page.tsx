import type { Metadata } from 'next'
import Link from 'next/link'
import { clampPage, listNotifications, str } from '@/lib/ceo/queries'
import { PageHeader, FilterChips } from '@/components/ceo/page-header'
import { DataTable, JsonInline, Mono, type Column } from '@/components/ceo/data-table'
import { Pagination } from '@/components/ceo/pagination'
import { NotificationStatusBadge } from '@/components/ceo/status-badge'
import { Ago } from '@/components/ceo/time'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Notifications' }

type Row = Awaited<ReturnType<typeof listNotifications>>['rows'][number]

export default async function CeoNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const kind = str(sp.kind) || undefined
  const status = str(sp.status) || undefined
  const page = clampPage(sp.page)
  const r = await listNotifications({ page, kind, status })
  const params = { kind: r.kind ?? undefined, status: r.status ?? undefined }

  const columns: Column<Row>[] = [
    { key: 'when', header: 'Sent', render: (x) => <Ago date={x.n.createdAt} /> },
    {
      key: 'kind',
      header: 'Kind',
      render: (x) => <Badge tone="beige">{x.n.kind.replace(/_/g, ' ')}</Badge>,
    },
    { key: 'channel', header: 'Channel', render: (x) => x.n.channel.replace(/_/g, ' ') },
    {
      key: 'recipient',
      header: 'Recipient',
      render: (x) => <span className="text-xs">{x.n.recipient}</span>,
    },
    {
      key: 'ws',
      header: 'Workspace',
      render: (x) =>
        x.n.workspaceId ? (
          <Link href={`/ceo/workspaces/${x.n.workspaceId}`} className="hover:text-pink-soft">
            {x.workspaceName ?? <Mono>{x.n.workspaceId}</Mono>}
          </Link>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (x) => (
        <span className="inline-flex items-center gap-1.5">
          <NotificationStatusBadge status={x.n.status} />
          {x.n.error ? (
            <span className="max-w-56 truncate text-xs text-danger" title={x.n.error}>
              {x.n.error}
            </span>
          ) : null}
        </span>
      ),
    },
    { key: 'meta', header: 'Details', render: (x) => <JsonInline value={x.n.metadata} /> },
  ]

  return (
    <>
      <PageHeader title="Notifications" description="Email and Discord delivery history." />
      <div className="flex flex-col gap-2">
        <FilterChips
          basePath="/ceo/notifications"
          param="kind"
          current={r.kind}
          extra={{ status: params.status }}
          options={[
            { value: null, label: 'All kinds' },
            ...r.kinds.map((k) => ({ value: k, label: k.replace(/_/g, ' ') })),
          ]}
        />
        <FilterChips
          basePath="/ceo/notifications"
          param="status"
          current={r.status}
          extra={{ kind: params.kind }}
          options={[
            { value: null, label: 'Any status' },
            { value: 'sent', label: 'Sent' },
            { value: 'failed', label: 'Failed' },
            { value: 'skipped', label: 'Skipped' },
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={r.rows}
        rowKey={(x) => x.n.id}
        empty="Nothing has been sent yet. Inactivity notices, invites and token rotations show up here."
      />
      <Pagination
        page={r.page}
        pageSize={r.pageSize}
        total={r.total}
        basePath="/ceo/notifications"
        params={params}
      />
    </>
  )
}
