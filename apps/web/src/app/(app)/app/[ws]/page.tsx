import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowUpRight,
  Clock,
  HardDrive,
  ListMusic,
  Settings,
  Ticket,
  Users,
} from '@/components/ui/icons'
import { can, effectiveQuotaBytes } from '@ume/db'
import { CAP, INACTIVITY, botInviteUrl, getPlan, isPaidPlan, linkSiteLabel } from '@ume/shared'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { UserAvatar } from '@/components/app/avatar'
import { PageHeader, Section } from '@/components/app/page-header'
import { StorageBar } from '@/components/app/storage-bar'
import { displayName, percent, relativeDays, trackStatusTone } from '@/lib/app/format'
import { listRecentAdditions } from '@/lib/app/queries'
import { isBotOnline, requireWorkspacePage } from '@/lib/app/workspace'
import { cn, formatDuration } from '@/lib/utils'

export const metadata: Metadata = { title: 'Overview', robots: { index: false } }

export default async function OverviewPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const { workspace, access } = await requireWorkspacePage(umeId)
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
      <PageHeader title={workspace.guildName} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BotStatusCard
          online={online}
          botInGuild={workspace.botInGuild}
          inviteUrl={
            can(access, CAP.MANAGE_SETTINGS)
              ? botInviteUrl(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? '', workspace.guildId)
              : null
          }
        />

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
            {paid ? null : (
              <p className="text-xs text-fg-muted [text-wrap:pretty]">
                Free workspaces are removed after {INACTIVITY.purgeAfterDays} idle days.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {quick.length ? (
        <div className="flex flex-wrap gap-3">
          {quick.map((q) => (
            <Link key={q.href} href={q.href} className={buttonClasses('outline', 'sm')}>
              <q.icon className="size-3.5" /> {q.label}
            </Link>
          ))}
        </div>
      ) : null}

      <Section
        title="Recent additions"
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
          <ul className="space-y-2">
            {recent.map((e) => {
              const status = trackStatusTone(e.track.status)
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3"
                >
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
    </>
  )
}

/**
 * Bot status: "Live" while the heartbeat is fresh, "Dead" otherwise. The squiggle and the
 * record are decoration (aria-hidden); the record spins only while Live and never under
 * reduced motion.
 */
function BotStatusCard({
  online,
  botInGuild,
  inviteUrl,
}: {
  online: boolean
  botInGuild: boolean
  inviteUrl: string | null
}) {
  return (
    <Card className="relative isolate min-h-44 overflow-hidden bg-linear-135 from-sage-light to-blush">
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 size-full"
        viewBox="0 0 300 176"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M-10 134C40 152 80 120 130 136S190 150 222 100 272 22 310 14"
          className="stroke-pink/45"
          strokeWidth={10}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className={cn(
          'pointer-events-none absolute -right-10 -bottom-10 -z-10 size-36 origin-center',
          online && 'animate-[spin_5s_linear_infinite] motion-reduce:animate-none',
        )}
      >
        <circle cx="50" cy="50" r="49" className="fill-sage" />
        {[42, 36, 30, 24].map((r) => (
          <circle
            key={r}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            className="stroke-sage-light/40"
            strokeWidth={1.2}
            strokeDasharray={`${r * 2.4} ${r * 0.8}`}
          />
        ))}
        <circle cx="50" cy="50" r="13" className="fill-blush" />
        <circle cx="55" cy="45" r="2.5" className="fill-pink/60" />
        <circle cx="50" cy="50" r="2" className="fill-sage" />
      </svg>
      <CardContent className="flex flex-col gap-3">
        <p className="font-display text-5xl leading-none font-semibold tracking-tight text-fg">
          <span className="sr-only">Bot status: </span>
          {online ? 'Live' : 'Dead'}
        </p>
        {!botInGuild ? (
          <p className="max-w-40 text-sm text-fg-muted [text-wrap:pretty]">
            Ume is not in this server.{' '}
            {inviteUrl ? (
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-fg underline underline-offset-4"
              >
                Add the bot
              </a>
            ) : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Cover({ src }: { src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
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
