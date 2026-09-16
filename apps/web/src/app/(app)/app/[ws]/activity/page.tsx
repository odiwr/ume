import type { Metadata } from 'next'
import {
  Activity,
  MessageSquare,
  Mic,
  Play,
  ScrollText,
  Shuffle,
  Volume2,
} from '@/components/ui/icons'
import { can } from '@ume/db'
import { CAP } from '@ume/shared'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Section } from '@/components/app/page-header'
import { Ago } from '@/components/app/time'
import { displayName } from '@/lib/app/format'
import { listActivity, listAudit, usersByIds } from '@/lib/app/queries'
import { requireWorkspacePage } from '@/lib/app/workspace'

export const metadata: Metadata = { title: 'Activity', robots: { index: false } }

const KIND: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  voice_join: { label: 'Joined the voice channel', icon: Mic },
  voice_leave: { label: 'Left the voice channel', icon: Mic },
  command: { label: 'Ran a command', icon: MessageSquare },
  play: { label: 'Played a track', icon: Play },
  web_action: { label: 'Changed something on the web', icon: Activity },
  bot_moved: { label: 'Bot moved to a new home channel', icon: Shuffle },
}

function describeMeta(meta: Record<string, unknown>): string | null {
  const parts: string[] = []
  if (typeof meta.command === 'string') parts.push(`/${meta.command}`)
  if (typeof meta.action === 'string') parts.push(String(meta.action))
  if (typeof meta.title === 'string') parts.push(`“${meta.title}”`)
  if (typeof meta.name === 'string') parts.push(`“${meta.name}”`)
  if (typeof meta.site === 'string') parts.push(String(meta.site))
  if (typeof meta.channelName === 'string') parts.push(`#${meta.channelName}`)
  return parts.length ? parts.join(' · ') : null
}

function auditLabel(action: string): string {
  return action.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export default async function ActivityPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const { workspace, access } = await requireWorkspacePage(umeId, CAP.VIEW_LIBRARY)
  const showAudit = access.isOwner || can(access, CAP.MANAGE_MEMBERS)
  const [events, audit] = await Promise.all([
    listActivity(workspace.id),
    showAudit ? listAudit(workspace.id) : Promise.resolve([]),
  ])
  const users = await usersByIds(events.map((e) => e.userId ?? '').filter(Boolean))

  return (
    <>
      <PageHeader
        title="Activity"
        description="Channel activity, commands, playback, and library changes."
      />

      <Section
        title="Recent activity"
        description={
          `Last activity ${workspace.lastActivityAt ? '' : 'unknown'}`.trim() || undefined
        }
      >
        {events.length ? (
          <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {events.map((e) => {
              const kind = KIND[e.kind] ?? { label: e.kind, icon: Activity }
              const Icon = kind.icon
              const who = e.userId ? users.get(e.userId) : null
              const detail = describeMeta(e.metadata)
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {kind.label}
                      {detail ? <span className="text-fg-muted"> · {detail}</span> : null}
                    </p>
                    <p className="truncate text-xs text-fg-muted">
                      {who
                        ? displayName(who)
                        : e.discordUserId
                          ? `Discord user ${e.discordUserId}`
                          : 'System'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-fg-subtle">
                    <Ago date={e.createdAt} />
                  </span>
                </li>
              )
            })}
          </ol>
        ) : (
          <EmptyState
            icon={<Volume2 className="size-6" />}
            title="Nothing yet"
            description="Once someone joins the home channel, runs a command or adds music, it shows up here."
          />
        )}
      </Section>

      {showAudit ? (
        <Section title="Audit log" description="Admin actions, visible to Admins and the Owner.">
          {audit.length ? (
            <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted">
                    <ScrollText className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{auditLabel(a.action)}</span>
                      {a.targetType ? <Badge>{a.targetType}</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-fg-muted">
                      {a.actor
                        ? displayName(a.actor)
                        : a.actorDiscordId
                          ? `Discord user ${a.actorDiscordId}`
                          : 'System'}
                      {describeMeta(a.metadata) ? ` · ${describeMeta(a.metadata)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-fg-subtle">
                    <Ago date={a.createdAt} />
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-fg-muted">No privileged actions recorded yet.</p>
          )}
        </Section>
      ) : null}
    </>
  )
}
