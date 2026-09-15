import type { Metadata } from 'next'
import Link from 'next/link'
import { Radio, TriangleAlert, Unplug, WifiOff } from 'lucide-react'
import { BOT_HEARTBEAT_MS } from '@ume/shared'
import { BOT_ONLINE_WINDOW_MS, getBotHealth, str, type BotHealth } from '@/lib/ceo/queries'
import { PageHeader, FilterChips, Section } from '@/components/ceo/page-header'
import { StatGrid, StatTile } from '@/components/ceo/stat-tile'
import { DataTable, Mono, type Column } from '@/components/ceo/data-table'
import { BotHealthBadge, WorkspaceStatusBadge } from '@/components/ceo/status-badge'
import { Ago } from '@/components/ceo/time'

export const metadata: Metadata = { title: 'Bot health' }

type Row = Awaited<ReturnType<typeof getBotHealth>>['rows'][number]

const n = (v: number) => v.toLocaleString('en-US')

const GROUPS: Array<{ health: BotHealth; title: string; description: string }> = [
  {
    health: 'online',
    title: 'Connected',
    description: `Heartbeat within the last ${BOT_ONLINE_WINDOW_MS / 1000} seconds.`,
  },
  {
    health: 'stale',
    title: 'Stale',
    description:
      'The row says connected but the heartbeat stopped. Usually the bot process died or lost its database connection; check the bot logs.',
  },
  {
    health: 'offline',
    title: 'Not connected',
    description:
      'The bot is in the guild but not in a voice channel. Unclaimed servers sit here until an admin runs /home or the bot reconnects.',
  },
  {
    health: 'not_in_guild',
    title: 'Not in guild',
    description:
      'The bot was kicked or the server was deleted. The workspace stays read-only; music is kept until purge.',
  },
]

export default async function CeoBotHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const filter = str(sp.health) || undefined
  const r = await getBotHealth(filter)

  const columns: Column<Row>[] = [
    {
      key: 'ws',
      header: 'Workspace',
      render: (w) => (
        <div className="min-w-0">
          <Link href={`/ceo/workspaces/${w.id}`} className="font-medium hover:text-pink-soft">
            {w.guildName}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Mono>{w.umeId}</Mono>
            <WorkspaceStatusBadge status={w.status} />
          </div>
        </div>
      ),
    },
    { key: 'health', header: 'Bot', render: (w) => <BotHealthBadge health={w.health} /> },
    {
      key: 'seen',
      header: 'Last seen',
      render: (w) => <Ago date={w.botLastSeenAt} fallback="never" />,
    },
    {
      key: 'channel',
      header: 'Voice channel',
      render: (w) =>
        w.botVoiceChannelId ? (
          <span className="inline-flex items-center gap-1.5">
            <Mono>{w.botVoiceChannelId}</Mono>
            {w.homeVoiceChannelId && w.homeVoiceChannelId !== w.botVoiceChannelId ? (
              <span
                className="text-[11px] text-warning"
                title={`Home channel is ${w.homeVoiceChannelId}`}
              >
                away from home
              </span>
            ) : null}
          </span>
        ) : w.homeVoiceChannelId ? (
          <span className="text-xs text-fg-muted">
            home <Mono>{w.homeVoiceChannelId}</Mono>
          </span>
        ) : (
          <span className="text-fg-subtle">no home set</span>
        ),
    },
    { key: 'guild', header: 'Guild id', render: (w) => <Mono>{w.guildId}</Mono> },
    { key: 'activity', header: 'Last activity', render: (w) => <Ago date={w.lastActivityAt} /> },
  ]

  const total = r.counts.online + r.counts.stale + r.counts.offline + r.counts.not_in_guild

  return (
    <>
      <PageHeader
        title="Bot health"
        description={`The bot writes a heartbeat every ${BOT_HEARTBEAT_MS / 1000} seconds per server. Purged workspaces are excluded; the list is capped at 500.`}
      />

      <StatGrid>
        <StatTile
          label="Connected"
          value={n(r.counts.online)}
          detail={`of ${n(total)} live workspaces`}
          icon={<Radio className="size-4" />}
          tone={r.counts.online > 0 ? 'success' : 'default'}
        />
        <StatTile
          label="Stale"
          value={n(r.counts.stale)}
          detail={
            r.counts.stale
              ? 'Connected flag set, heartbeat missing'
              : 'Every connected bot is reporting'
          }
          icon={<TriangleAlert className="size-4" />}
          tone={r.counts.stale > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="Not connected"
          value={n(r.counts.offline)}
          detail="In the guild, not in voice"
          icon={<WifiOff className="size-4" />}
        />
        <StatTile
          label="Not in guild"
          value={n(r.counts.not_in_guild)}
          detail={
            r.counts.not_in_guild
              ? 'Kicked or server deleted'
              : 'The bot is present everywhere it is expected'
          }
          icon={<Unplug className="size-4" />}
          tone={r.counts.not_in_guild > 0 ? 'danger' : 'default'}
        />
      </StatGrid>

      <FilterChips
        basePath="/ceo/bot"
        param="health"
        current={r.filter}
        options={[
          { value: null, label: 'All groups', count: total },
          ...GROUPS.map((g) => ({ value: g.health, label: g.title, count: r.counts[g.health] })),
        ]}
      />

      {r.filter ? (
        <DataTable
          columns={columns}
          rows={r.rows}
          rowKey={(w) => w.id}
          empty="No workspaces in this group."
        />
      ) : (
        GROUPS.map((g) => {
          const rows = r.rows.filter((w) => w.health === g.health)
          return (
            <Section
              key={g.health}
              title={`${g.title} (${n(rows.length)})`}
              description={g.description}
            >
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(w) => w.id}
                dense
                empty={`No workspaces are ${g.title.toLowerCase()}.`}
              />
            </Section>
          )
        })
      )}
    </>
  )
}
