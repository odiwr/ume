import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowUpRight,
  Clock,
  HardDrive,
  ListMusic,
  RadioTower,
  Settings,
  Ticket,
  Users,
} from '@/components/ui/icons'
import { can, effectiveQuotaBytes } from '@ume/db'
import { CAP, INACTIVITY, formatBytes, getPlan, isPaidPlan, linkSiteLabel } from '@ume/shared'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { UserAvatar } from '@/components/app/avatar'
import { PageHeader, Section } from '@/components/app/page-header'
import { StorageBar } from '@/components/app/storage-bar'
import { Ago } from '@/components/app/time'
import { displayName, percent, relativeDays, trackStatusTone } from '@/lib/app/format'
import { listRecentAdditions } from '@/lib/app/queries'
import { isBotOnline, requireWorkspacePage } from '@/lib/app/workspace'
import { formatDuration } from '@/lib/utils'

export const metadata: Metadata = { title: 'Overview', robots: { index: false } }

export default async function OverviewPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const { workspace, access, user } = await requireWorkspacePage(umeId)
  const recent = await listRecentAdditions(workspace.id, 8)

  const online = isBotOnline(workspace)
  const quota = effectiveQuotaBytes(workspace)
  const plan = getPlan(workspace.plan)
  const paid = isPaidPlan(workspace.plan)
  const idleDays = relativeDays(workspace.lastActivityAt)
  const daysLeft = Math.max(0, INACTIVITY.purgeAfterDays - idleDays)
  const purgeTone =
    daysLeft <= 2
      ? 'text-danger'
      : daysLeft <= INACTIVITY.purgeAfterDays - INACTIVITY.firstNoticeAtDays
        ? 'text-warning'
        : 'text-fg'
  const firstName = (user.name || user.discordUsername || 'there').split(' ')[0]

  const quick = [
    {
      href: `/app/${umeId}/library`,
      label: 'Open the library',
      icon: ListMusic,
      show: can(access, CAP.VIEW_LIBRARY),
    },
    {
      href: `/app/${umeId}/invites`,
      label: 'Invite curators',
      icon: Ticket,
      show: can(access, CAP.MANAGE_INVITES),
    },
    {
      href: `/app/${umeId}/members`,
      label: 'Manage members',
      icon: Users,
      show: can(access, CAP.MANAGE_MEMBERS),
    },
    {
      href: `/app/${umeId}/settings`,
      label: 'Bot settings',
      icon: Settings,
      show: can(access, CAP.MANAGE_SETTINGS),
    },
  ].filter((q) => q.show)

  return (
    <>
      <PageHeader
        title={workspace.guildName}
        eyebrow={`Hi ${firstName}`}
        description={
          workspace.status === 'connected'
            ? 'A quick read on the bot, the storage and what people added lately.'
            : 'This workspace is read-only until it is reconnected.'
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-fg-muted">
                <RadioTower className="size-4" aria-hidden /> Bot
              </span>
              <Badge tone={online ? 'success' : workspace.botInGuild ? 'warning' : 'danger'}>
                <span
                  className={
                    online
                      ? 'size-1.5 rounded-full bg-success'
                      : 'size-1.5 rounded-full bg-current opacity-60'
                  }
                  aria-hidden
                />
                {online ? 'Online' : workspace.botInGuild ? 'Offline' : 'Not in server'}
              </Badge>
            </div>
            <p className="font-display text-2xl font-semibold">
              {online ? (workspace.botVoiceChannelId ? 'In the room' : 'Standing by') : 'Quiet'}
            </p>
            <p className="text-xs text-fg-muted">
              {online ? (
                <>
                  Heartbeat <Ago date={workspace.botLastSeenAt} />
                </>
              ) : workspace.botLastSeenAt ? (
                <>
                  Last seen <Ago date={workspace.botLastSeenAt} />
                </>
              ) : (
                'Never connected yet.'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-fg-muted">
                <HardDrive className="size-4" aria-hidden /> Storage
              </span>
              <Badge tone={paid ? 'pink' : 'default'}>{plan.name}</Badge>
            </div>
            <p className="font-display text-2xl font-semibold tabular-nums">
              {percent(workspace.storageUsedBytes, quota)}%
            </p>
            <StorageBar used={workspace.storageUsedBytes} quota={quota} compact />
            <p className="text-xs text-fg-muted tabular-nums">
              {workspace.trackCount.toLocaleString('en-US')} of{' '}
              {plan.maxTracks.toLocaleString('en-US')} tracks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-fg-muted">
                <Clock className="size-4" aria-hidden /> Activity
              </span>
              {paid ? <Badge tone="sage">Never auto-removed</Badge> : null}
            </div>
            <p
              className={`font-display text-2xl font-semibold tabular-nums ${paid ? '' : purgeTone}`}
            >
              {paid
                ? idleDays === 0
                  ? 'Active today'
                  : `${idleDays}d idle`
                : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
            </p>
            <p className="text-xs text-fg-muted [text-wrap:pretty]">
              Last activity <Ago date={workspace.lastActivityAt} />.{' '}
              {paid
                ? 'Paid workspaces are never purged for inactivity.'
                : `Free workspaces are removed after ${INACTIVITY.purgeAfterDays} idle days. Any command, playback or web edit resets the clock.`}
            </p>
          </CardContent>
        </Card>
      </div>

      {quick.length ? (
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <Link key={q.href} href={q.href} className={buttonClasses('outline', 'sm')}>
              <q.icon className="size-3.5" /> {q.label}
            </Link>
          ))}
        </div>
      ) : null}

      <Section
        title="Recent additions"
        description="Latest tracks across all playlists."
        actions={
          <Link
            href={`/app/${umeId}/library`}
            className="inline-flex items-center gap-1 text-sm font-medium text-fg-muted hover:text-fg"
          >
            All playlists <ArrowUpRight className="size-3.5" />
          </Link>
        }
      >
        {recent.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {recent.map((e) => {
              const status = trackStatusTone(e.track.status)
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <Cover src={e.track.coverUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.track.title}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {e.track.artist ? `${e.track.artist} · ` : ''}
                      <Link
                        href={`/app/${umeId}/library/${e.playlist.slug}`}
                        className="hover:text-fg"
                      >
                        {e.playlist.name}
                      </Link>
                      {e.track.source === 'link'
                        ? ` · ${linkSiteLabel(e.track.sourceSite)}`
                        : ' · Upload'}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <UserAvatar user={e.addedBy} size={22} />
                    <span className="max-w-32 truncate text-xs text-fg-muted">
                      {displayName(e.addedBy)}
                    </span>
                  </div>
                  <span className="hidden text-xs text-fg-muted tabular-nums md:inline">
                    {formatDuration(e.track.durationMs)}
                  </span>
                  {e.track.status !== 'ready' ? (
                    <Badge tone={status.tone}>{status.label}</Badge>
                  ) : null}
                  <span className="text-xs text-fg-subtle">
                    <Ago date={e.addedAt} />
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<ListMusic className="size-6" />}
            title="Nothing added yet"
            description="Upload a file or add a link to a playlist."
          >
            <Link href={`/app/${umeId}/library`} className={buttonClasses('primary', 'sm')}>
              Go to the library
            </Link>
          </EmptyState>
        )}
      </Section>

      <p className="text-xs text-fg-subtle">
        {formatBytes(workspace.storageUsedBytes)} of {formatBytes(quota)} used across{' '}
        {workspace.trackCount.toLocaleString('en-US')} tracks.
      </p>
    </>
  )
}

function Cover({ src }: { src: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-lg bg-surface-3 object-cover"
      />
    )
  }
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-subtle"
      aria-hidden
    >
      <ListMusic className="size-4" />
    </span>
  )
}
