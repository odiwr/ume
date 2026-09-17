import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from '@/components/ui/icons'
import { formatBytes, guildIconUrl } from '@ume/shared'
import { getWorkspaceDetail, classifyBot } from '@/lib/ceo/queries'
import { PageHeader, KeyValue, Section } from '@/components/ceo/page-header'
import { DataTable, Mono, type Column } from '@/components/ceo/data-table'
import { StatGrid, StatTile } from '@/components/ceo/stat-tile'
import {
  BotHealthBadge,
  NotificationStatusBadge,
  PlanBadge,
  SubscriptionBadge,
  TrackStatusBadge,
  WorkspaceStatusBadge,
  DmcaStatusBadge,
} from '@/components/ceo/status-badge'
import { Ago, Absolute } from '@/components/ceo/time'
import { WorkspaceActions } from '@/components/ceo/workspace-actions'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WorkspaceDetail } from '@/lib/ceo/queries'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const d = await getWorkspaceDetail(id)
  return { title: d ? d.ws.guildName : 'Workspace' }
}

type Member = WorkspaceDetail['members'][number]
type PlaylistRow = WorkspaceDetail['playlists'][number]
type AuditRow = WorkspaceDetail['audit'][number]
type ActivityRow = WorkspaceDetail['activity'][number]
type NotificationRow = WorkspaceDetail['notifications'][number]

export default async function CeoWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const d = await getWorkspaceDetail(id)
  if (!d) notFound()
  const { ws } = d
  const icon = guildIconUrl(ws.guildId, ws.guildIcon, 64)
  const pct = d.quotaBytes > 0 ? Math.round((ws.storageUsedBytes / d.quotaBytes) * 100) : 0

  const memberColumns: Column<Member>[] = [
    {
      key: 'user',
      header: 'Member',
      render: (m) => (
        <div>
          <Link href={`/ceo/users/${m.user.id}`} className="font-medium hover:text-pink-soft">
            {m.user.name || m.user.email}
          </Link>
          <p className="text-xs text-fg-muted">
            {m.user.email}
            {m.user.discordUsername ? ` · @${m.user.discordUsername}` : ''}
            {m.user.banned ? ' · banned' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (m) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="size-2 rounded-full" style={{ background: m.role.color }} />
          {m.role.name}
          {m.role.systemKey ? (
            <span className="text-xs text-fg-subtle">({m.role.systemKey})</span>
          ) : null}
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

  const playlistColumns: Column<PlaylistRow>[] = [
    {
      key: 'name',
      header: 'Playlist',
      render: (b) => (
        <span>
          {b.emoji ? `${b.emoji} ` : ''}
          {b.name} <Mono>{b.slug}</Mono>
        </span>
      ),
    },
    {
      key: 'tracks',
      header: 'Tracks',
      align: 'right',
      render: (b) => b.trackCount.toLocaleString('en-US'),
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      render: (b) => `${Math.round(b.totalDurationMs / 60000)} min`,
    },
    { key: 'created', header: 'Created', render: (b) => <Ago date={b.createdAt} /> },
  ]

  const auditColumns: Column<AuditRow>[] = [
    { key: 'when', header: 'When', render: (a) => <Ago date={a.createdAt} /> },
    { key: 'action', header: 'Action', render: (a) => <Mono>{a.action}</Mono> },
    {
      key: 'actor',
      header: 'Actor',
      render: (a) =>
        a.actor?.email ??
        (a.actorDiscordId ? (
          <Mono>discord:{a.actorDiscordId}</Mono>
        ) : (
          <span className="text-fg-subtle">system</span>
        )),
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

  const activityColumns: Column<ActivityRow>[] = [
    { key: 'when', header: 'When', render: (a) => <Ago date={a.createdAt} /> },
    { key: 'kind', header: 'Kind', render: (a) => <Badge>{a.kind.replace('_', ' ')}</Badge> },
    {
      key: 'who',
      header: 'Who',
      render: (a) =>
        a.userId ? (
          <Mono>{a.userId}</Mono>
        ) : a.discordUserId ? (
          <Mono>discord:{a.discordUserId}</Mono>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: 'meta',
      header: 'Details',
      render: (a) => (
        <span className="text-xs text-fg-muted">
          {Object.keys(a.metadata).length ? JSON.stringify(a.metadata) : ''}
        </span>
      ),
    },
  ]

  const notificationColumns: Column<NotificationRow>[] = [
    { key: 'when', header: 'When', render: (r) => <Ago date={r.createdAt} /> },
    {
      key: 'kind',
      header: 'Kind',
      render: (r) => <Badge tone="beige">{r.kind.replace('_', ' ')}</Badge>,
    },
    { key: 'channel', header: 'Channel', render: (r) => r.channel.replace('_', ' ') },
    {
      key: 'recipient',
      header: 'Recipient',
      render: (r) => <span className="text-xs">{r.recipient}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <NotificationStatusBadge status={r.status} />,
    },
  ]

  return (
    <>
      <PageHeader
        back={{ href: '/ceo/workspaces', label: 'Workspaces' }}
        title={
          <span className="inline-flex items-center gap-3">
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={icon}
                alt=""
                width={40}
                height={40}
                className="size-10 rounded-xl bg-surface-3"
              />
            ) : (
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-surface-3 font-display text-lg">
                {ws.guildName.slice(0, 1)}
              </span>
            )}
            {ws.guildName}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Mono>{ws.umeId}</Mono>
            <WorkspaceStatusBadge status={ws.status} />
            <PlanBadge plan={ws.plan} />
            <BotHealthBadge health={classifyBot(ws)} />
          </span>
        }
        actions={
          ws.status !== 'purged' ? (
            <Link
              href={`/app/${ws.umeId}`}
              className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
              target="_blank"
            >
              Open in app <ExternalLink className="size-3.5" />
            </Link>
          ) : null
        }
      />

      <StatGrid>
        <StatTile
          label="Storage"
          value={formatBytes(ws.storageUsedBytes)}
          detail={`${pct}% of ${formatBytes(d.quotaBytes)}`}
          tone={pct >= 100 ? 'danger' : pct >= 85 ? 'warning' : 'default'}
        />
        <StatTile
          label="Tracks"
          value={ws.trackCount.toLocaleString('en-US')}
          detail={
            d.tracksByStatus.map((t) => `${t.status} ${t.count}`).join(' · ') || 'No tracks yet'
          }
        />
        <StatTile
          label="Members"
          value={d.members.length}
          detail={`${d.invites.active} active invite${d.invites.active === 1 ? '' : 's'} · ${d.roles.length} roles`}
        />
        <StatTile
          label="Last activity"
          value={<Ago date={ws.lastActivityAt} />}
          detail={
            <>
              Created <Absolute date={ws.createdAt} />
            </>
          }
        />
      </StatGrid>

      <Section title="Record">
        <Card>
          <CardContent>
            <KeyValue
              items={[
                { label: 'Workspace id', value: <Mono>{ws.id}</Mono> },
                { label: 'Guild id', value: <Mono>{ws.guildId}</Mono> },
                {
                  label: 'Guild owner (Discord)',
                  value: ws.guildOwnerDiscordId ? <Mono>{ws.guildOwnerDiscordId}</Mono> : null,
                },
                {
                  label: 'Owner (Ume)',
                  value: d.ws.owner ? (
                    <Link href={`/ceo/users/${d.ws.owner.id}`} className="hover:text-pink-soft">
                      {d.ws.owner.email}
                      {d.ws.owner.discordUsername ? ` · @${d.ws.owner.discordUsername}` : ''}
                    </Link>
                  ) : null,
                },
                { label: 'Claimed', value: <Absolute date={ws.claimedAt} fallback="never" /> },
                {
                  label: 'Disconnected',
                  value: <Absolute date={ws.disconnectedAt} fallback="—" />,
                },
                { label: 'Purged', value: <Absolute date={ws.purgedAt} fallback="—" /> },
                { label: 'Created', value: <Absolute date={ws.createdAt} /> },
                {
                  label: 'Home voice channel',
                  value: ws.homeVoiceChannelId ? <Mono>{ws.homeVoiceChannelId}</Mono> : null,
                },
                {
                  label: 'Bot voice channel',
                  value: ws.botVoiceChannelId ? <Mono>{ws.botVoiceChannelId}</Mono> : null,
                },
                {
                  label: 'Notice text channel',
                  value: ws.noticeTextChannelId ? <Mono>{ws.noticeTextChannelId}</Mono> : null,
                },
                { label: 'Bot last seen', value: <Ago date={ws.botLastSeenAt} fallback="never" /> },
                { label: 'Bot in guild', value: ws.botInGuild ? 'yes' : 'no' },
                {
                  label: 'Inactivity 30-day notice',
                  value: <Absolute date={ws.inactivityNotice30dSentAt} fallback="not sent" />,
                },
                {
                  label: 'Inactivity 48-hour notice',
                  value: <Absolute date={ws.inactivityNotice48hSentAt} fallback="not sent" />,
                },
                {
                  label: 'Quota override',
                  value:
                    ws.storageQuotaOverrideBytes !== null
                      ? formatBytes(ws.storageQuotaOverrideBytes)
                      : 'none',
                },
                {
                  label: 'Stripe customer',
                  value: ws.stripeCustomerId ? (
                    <a
                      href={`https://dashboard.stripe.com/customers/${ws.stripeCustomerId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-pink-soft"
                    >
                      <Mono>{ws.stripeCustomerId}</Mono> <ExternalLink className="size-3" />
                    </a>
                  ) : null,
                },
                {
                  label: 'Stripe subscription',
                  value: ws.stripeSubscriptionId ? <Mono>{ws.stripeSubscriptionId}</Mono> : null,
                },
                {
                  label: 'Subscription status',
                  value: <SubscriptionBadge status={ws.stripeSubscriptionStatus} />,
                },
                { label: 'Renews', value: <Absolute date={ws.planRenewsAt} fallback="—" /> },
                {
                  label: 'Discord role sync',
                  value: ws.discordRoleSyncEnabled ? 'enabled' : 'disabled',
                },
                {
                  label: 'Default role id',
                  value: ws.defaultRoleId ? (
                    <Mono>{ws.defaultRoleId}</Mono>
                  ) : (
                    'none (no access for unmapped members)'
                  ),
                },
                {
                  label: 'Link extractor (workspace)',
                  value: ws.linkExtractEnabled ? 'enabled' : 'disabled',
                },
                {
                  label: 'Rights attestation',
                  value: <Absolute date={ws.linkExtractAcceptedAt} fallback="not accepted" />,
                },
              ]}
            />
          </CardContent>
        </Card>
      </Section>

      <Section title="Admin actions">
        <WorkspaceActions ws={ws} quotaBytes={d.quotaBytes} />
      </Section>

      <Section title={`Members (${d.members.length})`}>
        <DataTable
          columns={memberColumns}
          rows={d.members}
          rowKey={(m) => m.id}
          empty="No members. The Owner appears once the workspace is claimed."
        />
      </Section>

      <Section title={`Playlists (${d.playlists.length})`}>
        <DataTable
          columns={playlistColumns}
          rows={d.playlists}
          rowKey={(b) => b.id}
          empty="No playlists yet."
          dense
        />
      </Section>

      {d.tracksByStatus.length ? (
        <Section title="Tracks by status">
          <div className="flex flex-wrap gap-2">
            {d.tracksByStatus.map((t) => (
              <Card key={t.status} className="px-4 py-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <TrackStatusBadge status={t.status} />
                  <span className="tabular-nums">{t.count.toLocaleString('en-US')}</span>
                  <span className="text-xs text-fg-muted">{formatBytes(t.bytes)}</span>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {d.dmca.length ? (
        <Section title="DMCA notices">
          <Card>
            <ul className="space-y-1 p-2">
              {d.dmca.map((nte) => (
                <li
                  key={nte.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm"
                >
                  <Link href={`/ceo/dmca/${nte.id}`} className="hover:text-pink-soft">
                    {nte.claimantName} — {nte.workDescription.slice(0, 80)}
                    {nte.workDescription.length > 80 ? '…' : ''}
                  </Link>
                  <span className="inline-flex items-center gap-2">
                    <DmcaStatusBadge status={nte.status} /> <Ago date={nte.createdAt} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section
          title="Recent audit"
          actions={
            <Link
              href={`/ceo/audit?workspaceId=${ws.id}`}
              className="text-sm text-fg-muted hover:text-fg"
            >
              All
            </Link>
          }
        >
          <DataTable
            columns={auditColumns}
            rows={d.audit}
            rowKey={(a) => a.id}
            empty="No audit entries yet."
            dense
          />
        </Section>
        <Section title="Recent activity">
          <DataTable
            columns={activityColumns}
            rows={d.activity}
            rowKey={(a) => a.id}
            empty="No activity recorded."
            dense
          />
        </Section>
      </div>

      <Section title="Notifications sent">
        <DataTable
          columns={notificationColumns}
          rows={d.notifications}
          rowKey={(r) => r.id}
          empty="Nothing sent to this workspace yet."
          dense
        />
      </Section>
    </>
  )
}
