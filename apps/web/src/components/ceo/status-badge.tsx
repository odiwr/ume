import { Badge, type BadgeTone } from '@/components/ui/badge'
import type { WorkspaceStatus, TrackStatus } from '@/lib/db'
import type { BotHealth, DmcaStatus } from '@/lib/ceo/queries'

const workspaceTones: Record<WorkspaceStatus, BadgeTone> = {
  unclaimed: 'beige',
  connected: 'success',
  disconnected: 'warning',
  purging: 'danger',
  purged: 'default',
}

export function WorkspaceStatusBadge({ status }: { status: WorkspaceStatus }) {
  return <Badge tone={workspaceTones[status]}>{status}</Badge>
}

const trackTones: Record<TrackStatus, BadgeTone> = {
  pending: 'beige',
  processing: 'warning',
  ready: 'success',
  failed: 'danger',
  disabled: 'danger',
}

export function TrackStatusBadge({ status }: { status: TrackStatus }) {
  return <Badge tone={trackTones[status]}>{status}</Badge>
}

const planTones: Record<string, BadgeTone> = { free: 'default', plus: 'sage', pro: 'pink', studio: 'pink' }

export function PlanBadge({ plan }: { plan: string }) {
  return <Badge tone={planTones[plan] ?? 'default'}>{plan}</Badge>
}

const botTones: Record<BotHealth, BadgeTone> = { online: 'success', stale: 'warning', offline: 'default', not_in_guild: 'danger' }
const botLabels: Record<BotHealth, string> = { online: 'online', stale: 'stale', offline: 'offline', not_in_guild: 'not in guild' }

export function BotHealthBadge({ health }: { health: BotHealth }) {
  return (
    <Badge tone={botTones[health]}>
      <span className={health === 'online' ? 'size-1.5 rounded-full bg-success' : 'size-1.5 rounded-full bg-current opacity-60'} />
      {botLabels[health]}
    </Badge>
  )
}

const dmcaTones: Record<DmcaStatus, BadgeTone> = {
  received: 'warning',
  actioned: 'danger',
  counter_noticed: 'beige',
  restored: 'success',
  rejected: 'default',
}

export function DmcaStatusBadge({ status }: { status: DmcaStatus }) {
  return <Badge tone={dmcaTones[status]}>{status.replace('_', ' ')}</Badge>
}

const subscriptionTones: Record<string, BadgeTone> = {
  active: 'success',
  trialing: 'sage',
  past_due: 'warning',
  unpaid: 'danger',
  canceled: 'default',
  incomplete: 'warning',
  incomplete_expired: 'default',
  paused: 'beige',
}

export function SubscriptionBadge({ status }: { status: string | null }) {
  if (!status) return <Badge>none</Badge>
  return <Badge tone={subscriptionTones[status] ?? 'default'}>{status.replace('_', ' ')}</Badge>
}

export function NotificationStatusBadge({ status }: { status: string }) {
  const tone: BadgeTone = status === 'sent' ? 'success' : status === 'failed' ? 'danger' : 'default'
  return <Badge tone={tone}>{status}</Badge>
}
