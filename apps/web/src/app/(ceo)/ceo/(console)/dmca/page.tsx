import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { DMCA_STATUSES, listDmcaNotices, str } from '@/lib/ceo/queries'
import { PageHeader, FilterChips } from '@/components/ceo/page-header'
import { DataTable, type Column } from '@/components/ceo/data-table'
import { DmcaStatusBadge, TrackStatusBadge } from '@/components/ceo/status-badge'
import { Ago } from '@/components/ceo/time'

export const metadata: Metadata = { title: 'DMCA' }

type Row = Awaited<ReturnType<typeof listDmcaNotices>>['rows'][number]

const STATUS_LABELS: Record<(typeof DMCA_STATUSES)[number], string> = {
  received: 'Received',
  actioned: 'Actioned',
  counter_noticed: 'Counter-noticed',
  restored: 'Restored',
  rejected: 'Rejected',
}

export default async function CeoDmcaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const r = await listDmcaNotices(str(sp.status) || undefined)
  const total = DMCA_STATUSES.reduce((a, s) => a + r.counts[s], 0)

  const columns: Column<Row>[] = [
    {
      key: 'claim',
      header: 'Notice',
      className: 'max-w-md whitespace-normal',
      render: (x) => (
        <div className="min-w-0">
          <Link href={`/ceo/dmca/${x.notice.id}`} className="font-medium hover:text-pink-soft">
            {x.notice.claimantName}
          </Link>
          <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted [text-wrap:pretty]">
            {x.notice.workDescription}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (x) => <DmcaStatusBadge status={x.notice.status} />,
    },
    {
      key: 'track',
      header: 'Track',
      render: (x) =>
        x.notice.trackId ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="max-w-48 truncate">{x.trackTitle ?? x.notice.trackId}</span>
            {x.trackStatus ? (
              <TrackStatusBadge status={x.trackStatus} />
            ) : (
              <span className="text-xs text-fg-subtle">deleted</span>
            )}
          </span>
        ) : (
          <a
            href={x.notice.infringingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
          >
            unmatched URL <ExternalLink className="size-3" />
          </a>
        ),
    },
    {
      key: 'ws',
      header: 'Workspace',
      render: (x) =>
        x.notice.workspaceId ? (
          <Link href={`/ceo/workspaces/${x.notice.workspaceId}`} className="hover:text-pink-soft">
            {x.workspaceName ?? x.notice.workspaceId}
          </Link>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    { key: 'received', header: 'Received', render: (x) => <Ago date={x.notice.createdAt} /> },
    { key: 'updated', header: 'Updated', render: (x) => <Ago date={x.notice.updatedAt} /> },
  ]

  return (
    <>
      <PageHeader
        title="DMCA"
        description="Takedown notices submitted through /dmca. Act on received notices promptly: disable the track, block the hash, then wait for a counter-notice."
      />
      <FilterChips
        basePath="/ceo/dmca"
        current={r.filter}
        options={[
          { value: null, label: 'All', count: total },
          ...DMCA_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s], count: r.counts[s] })),
        ]}
      />
      <DataTable
        columns={columns}
        rows={r.rows}
        rowKey={(x) => x.notice.id}
        empty={
          r.filter
            ? `No ${STATUS_LABELS[r.filter].toLowerCase()} notices.`
            : 'No takedown notices have been filed.'
        }
      />
      {r.rows.length >= 200 ? (
        <p className="text-xs text-fg-subtle">
          Showing the 200 most recent. Filter by status to see older notices.
        </p>
      ) : null}
    </>
  )
}
