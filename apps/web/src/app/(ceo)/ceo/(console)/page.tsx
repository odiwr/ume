import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Activity,
  Clock,
  Database,
  DollarSign,
  HardDrive,
  Music,
  Radio,
  Server,
  TriangleAlert,
  Users,
} from '@/components/ui/icons'
import { formatBytes } from '@ume/shared'
import { getOverview, listIdleFreeWorkspaces } from '@/lib/ceo/queries'
import { PageHeader, Section } from '@/components/ceo/page-header'
import { StatGrid, StatTile } from '@/components/ceo/stat-tile'
import { StorageByPlanChart, WorkspacesPerWeekChart } from '@/components/ceo/charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Ago } from '@/components/ceo/time'
import { Mono } from '@/components/ceo/data-table'

export const metadata: Metadata = { title: 'Overview' }

const n = (v: number) => v.toLocaleString('en-US')

export default async function CeoOverviewPage() {
  const [o, idle] = await Promise.all([getOverview(), listIdleFreeWorkspaces(30, 8)])

  return (
    <>
      <PageHeader title="Overview" description="Current usage and service status." />

      <StatGrid>
        <StatTile
          label="Workspaces"
          value={n(o.workspaces.total)}
          detail={`${n(o.workspaces.connected)} connected · ${n(o.workspaces.active7d)} active in 7 days`}
          icon={<Server className="size-4" />}
          tone="pink"
        />
        <StatTile
          label="Users"
          value={n(o.users.total)}
          detail={`${n(o.users.withDiscord)} with Discord linked${o.users.banned ? ` · ${n(o.users.banned)} banned` : ''}`}
          icon={<Users className="size-4" />}
        />
        <StatTile
          label="Tracks ready"
          value={n(o.tracks.ready)}
          detail={`${n(o.tracks.inFlight)} in flight · ${n(o.tracks.failed)} failed${o.tracks.disabled ? ` · ${n(o.tracks.disabled)} disabled` : ''}`}
          icon={<Music className="size-4" />}
          tone={o.tracks.failed > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="Storage used"
          value={formatBytes(o.storageUsedBytes)}
          detail="Sum of every workspace's normalized Opus"
          icon={<HardDrive className="size-4" />}
        />
        <StatTile
          label="MRR"
          value={`$${n(o.mrrUsd)}`}
          detail={`${n(o.paidWorkspaces)} paid workspace${o.paidWorkspaces === 1 ? '' : 's'} active or trialing`}
          icon={<DollarSign className="size-4" />}
          tone="success"
        />
        <StatTile
          label="Bot online"
          value={`${n(o.workspaces.botOnline)} / ${n(o.workspaces.connected)}`}
          detail="Heartbeat within the last 90 seconds"
          icon={<Radio className="size-4" />}
          tone={
            o.workspaces.connected > 0 && o.workspaces.botOnline < o.workspaces.connected
              ? 'warning'
              : 'default'
          }
        />
        <StatTile
          label="Pending purges"
          value={n(o.workspaces.purging)}
          detail="Confirmed; the worker is deleting storage"
          icon={<Clock className="size-4" />}
          tone={o.workspaces.purging > 0 ? 'danger' : 'default'}
        />
        <StatTile
          label="Failed jobs"
          value={o.jobs.available ? n(o.jobs.failed) : '—'}
          detail={
            o.jobs.available
              ? o.jobs.byState.map((s) => `${s.state} ${n(s.count)}`).join(' · ') ||
                'Queue is empty'
              : 'pg-boss schema not created yet (worker has not started)'
          }
          icon={<Database className="size-4" />}
          tone={o.jobs.failed > 0 ? 'danger' : 'default'}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New workspaces per week</CardTitle>
            <CardDescription>
              Servers that met the bot for the first time, last 12 ISO weeks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkspacesPerWeekChart data={o.weekly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Storage by plan</CardTitle>
            <CardDescription>
              Bytes stored per tier. Free is the long tail; paid tiers are the bill.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StorageByPlanChart data={o.storageByPlan} />
          </CardContent>
        </Card>
      </div>

      <Section
        title="Approaching auto-purge"
        description="Free, connected workspaces idle for 30+ days. The sweep sends the 30-day notice, then the 48-hour notice, then purges at 60."
        actions={
          <Link
            href="/ceo/workspaces?status=connected"
            className="text-sm text-fg-muted hover:text-fg"
          >
            All workspaces
          </Link>
        }
      >
        {idle.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 text-sm text-fg-muted">
              <Activity className="size-4 text-success" /> Nothing is close to the purge line.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {idle.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/ceo/workspaces/${w.id}`}
                      className="font-medium hover:text-pink-soft"
                    >
                      {w.guildName}
                    </Link>
                    <div className="mt-0.5">
                      <Mono>{w.umeId}</Mono>
                    </div>
                  </div>
                  <Badge tone="warning">
                    <TriangleAlert className="size-3" /> last activity{' '}
                    <Ago date={w.lastActivityAt} />
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>
    </>
  )
}
