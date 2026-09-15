import type { Metadata } from 'next'
import Link from 'next/link'
import { Database, HardDrive, ShieldOff, Music } from 'lucide-react'
import { formatBytes } from '@ume/shared'
import { getStorageReport } from '@/lib/ceo/queries'
import { PageHeader, Section } from '@/components/ceo/page-header'
import { StatGrid, StatTile } from '@/components/ceo/stat-tile'
import { DataTable, Mono, type Column } from '@/components/ceo/data-table'
import { UsageBar } from '@/components/ceo/charts'
import { PlanBadge, TrackStatusBadge, WorkspaceStatusBadge } from '@/components/ceo/status-badge'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Storage' }

type Report = Awaited<ReturnType<typeof getStorageReport>>
type TopRow = Report['top'][number]
type PlanRow = Report['byPlan'][number]

const n = (v: number) => v.toLocaleString('en-US')

export default async function CeoStoragePage() {
  const r = await getStorageReport()
  const totalBytes = r.byPlan.reduce((a, b) => a + b.bytes, 0)
  const totalQuota = r.byPlan.reduce((a, b) => a + b.quotaBytes, 0)
  const ready = r.byStatus.find((s) => s.status === 'ready')
  const disabled = r.byStatus.find((s) => s.status === 'disabled')
  const overQuota = r.top.filter(
    (w) => w.quotaBytes > 0 && w.storageUsedBytes >= w.quotaBytes,
  ).length

  const planColumns: Column<PlanRow>[] = [
    { key: 'plan', header: 'Plan', render: (p) => <PlanBadge plan={p.plan} /> },
    { key: 'workspaces', header: 'Workspaces', align: 'right', render: (p) => n(p.workspaces) },
    { key: 'tracks', header: 'Tracks', align: 'right', render: (p) => n(p.tracks) },
    { key: 'bytes', header: 'Stored', align: 'right', render: (p) => formatBytes(p.bytes) },
    {
      key: 'quota',
      header: 'Sold quota',
      align: 'right',
      render: (p) => formatBytes(p.quotaBytes),
    },
    {
      key: 'usage',
      header: 'Fill',
      render: (p) => <UsageBar used={p.bytes} quota={p.quotaBytes} />,
    },
  ]

  const topColumns: Column<TopRow>[] = [
    {
      key: 'ws',
      header: 'Workspace',
      render: (w) => (
        <div className="min-w-0">
          <Link href={`/ceo/workspaces/${w.id}`} className="font-medium hover:text-pink-soft">
            {w.guildName}
          </Link>
          <div className="mt-0.5">
            <Mono>{w.umeId}</Mono>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (w) => <WorkspaceStatusBadge status={w.status} /> },
    { key: 'plan', header: 'Plan', render: (w) => <PlanBadge plan={w.plan} /> },
    { key: 'tracks', header: 'Tracks', align: 'right', render: (w) => n(w.trackCount) },
    { key: 'used', header: 'Used', align: 'right', render: (w) => formatBytes(w.storageUsedBytes) },
    {
      key: 'quota',
      header: 'Quota',
      align: 'right',
      render: (w) => (
        <span>
          {formatBytes(w.quotaBytes)}
          {w.storageQuotaOverrideBytes !== null ? (
            <span className="ml-1 text-[11px] text-pink-soft">override</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'usage',
      header: 'Fill',
      render: (w) => <UsageBar used={w.storageUsedBytes} quota={w.quotaBytes} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Storage"
        description="Bytes are normalized Opus, so 1 GB is roughly 17 hours of music at 128 kbps. Usage counters come from workspaces.storage_used_bytes and are reconciled daily by the worker."
      />

      <StatGrid>
        <StatTile
          label="Stored"
          value={formatBytes(totalBytes)}
          detail={`of ${formatBytes(totalQuota)} sold quota across live workspaces`}
          icon={<HardDrive className="size-4" />}
          tone="pink"
        />
        <StatTile
          label="Ready tracks"
          value={ready ? n(ready.count) : '0'}
          detail={ready ? `${formatBytes(ready.bytes)} playable` : 'No ready tracks yet'}
          icon={<Music className="size-4" />}
        />
        <StatTile
          label="Over quota"
          value={n(overQuota)}
          detail={
            overQuota
              ? 'Uploads are read-only there until they free space or upgrade'
              : 'Nobody is at their ceiling in the top 30'
          }
          icon={<Database className="size-4" />}
          tone={overQuota > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="Blocked hashes"
          value={n(r.blockedHashes)}
          detail={
            disabled
              ? `${n(disabled.count)} disabled track${disabled.count === 1 ? '' : 's'} (${formatBytes(disabled.bytes)}) kept for counter-notice`
              : 'No takedowns yet'
          }
          icon={<ShieldOff className="size-4" />}
          tone={r.blockedHashes > 0 ? 'danger' : 'default'}
        />
      </StatGrid>

      <Section
        title="By plan"
        description="Sold quota is workspaces × plan storage; overrides are not counted here."
      >
        <DataTable columns={planColumns} rows={r.byPlan} rowKey={(p) => p.plan} dense />
      </Section>

      <Section
        title="Tracks by status"
        description="pending and processing are in the worker queue; failed rows still count toward the workspace track count until reconciled."
      >
        {r.byStatus.length === 0 ? (
          <Card className="px-5 py-4 text-sm text-fg-muted">
            No tracks have been added anywhere yet.
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            {r.byStatus.map((s) => (
              <Card key={s.status} className="px-4 py-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <TrackStatusBadge status={s.status} />
                  <span className="tabular-nums">{n(s.count)}</span>
                  <span className="text-xs text-fg-muted">{formatBytes(s.bytes)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Top 30 workspaces by usage"
        actions={
          <Link href="/ceo/workspaces" className="text-sm text-fg-muted hover:text-fg">
            All workspaces
          </Link>
        }
      >
        <DataTable
          columns={topColumns}
          rows={r.top}
          rowKey={(w) => w.id}
          empty="No workspace has stored anything yet."
        />
      </Section>
    </>
  )
}
