import Link from 'next/link'
import { KeyRound, RadioTower, Trash2 } from '@/components/ui/icons'
import type { Workspace } from '@ume/db'
import { Ago } from '@/components/app/time'
import { isBotOnline } from '@/lib/app/workspace'

/**
 * Persistent banners at the top of every workspace page: disconnected (needs a new
 * token), purging, and bot offline (no heartbeat for 90 s).
 */
export function WorkspaceBanners({ workspace, canManageSettings }: { workspace: Workspace; canManageSettings: boolean }) {
  const items: React.ReactNode[] = []

  if (workspace.status === 'disconnected') {
    items.push(
      <Banner key="disconnected" tone="warning" icon={<KeyRound className="size-4" />}>
        <span>
          <strong className="font-semibold">Disconnected.</strong> Someone ran <code className="font-mono">/reload</code> in Discord
          {workspace.disconnectedAt ? (
            <>
              {' '}
              <Ago date={workspace.disconnectedAt} />
            </>
          ) : null}
          . The workspace is read-only until the new token is entered.
        </span>
        {canManageSettings ? (
          <Link href={`/app/${workspace.umeId}/settings#connection`} className="ml-auto shrink-0 font-semibold underline underline-offset-4">
            Enter the new token
          </Link>
        ) : null}
      </Banner>,
    )
  } else if (workspace.status === 'unclaimed') {
    items.push(
      <Banner key="unclaimed" tone="warning" icon={<KeyRound className="size-4" />}>
        <span>This server has not been claimed on the web yet.</span>
      </Banner>,
    )
  } else if (workspace.status === 'purging') {
    items.push(
      <Banner key="purging" tone="danger" icon={<Trash2 className="size-4" />}>
        <span>
          <strong className="font-semibold">Purge in progress.</strong> Playlists, music and members are being deleted. This cannot be undone.
        </span>
      </Banner>,
    )
  }

  if (workspace.status === 'connected' && !isBotOnline(workspace)) {
    items.push(
      <Banner key="bot" tone="info" icon={<RadioTower className="size-4" />}>
        <span>
          <strong className="font-semibold text-fg">Bot offline.</strong>{' '}
          {workspace.botInGuild
            ? <>Last heartbeat <Ago date={workspace.botLastSeenAt} />. Playback commands will not respond until it reconnects.</>
            : 'Ume is not in this Discord server. Invite the bot from the server picker to start playing.'}
        </span>
        {!workspace.botInGuild ? (
          <Link href="/app/new" className="ml-auto shrink-0 font-semibold text-fg underline underline-offset-4">
            Server picker
          </Link>
        ) : null}
      </Banner>,
    )
  }

  if (!items.length) return null
  return <div className="space-y-2 px-4 pt-4 sm:px-6 lg:px-8">{items}</div>
}

function Banner({ tone, icon, children }: { tone: 'warning' | 'danger' | 'info'; icon: React.ReactNode; children: React.ReactNode }) {
  const tones = {
    warning: 'border-warning/30 bg-warning/10 text-warning',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    info: 'border-border bg-surface-2 text-fg-muted',
  }
  return (
    <div role="status" className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm [text-wrap:pretty] ${tones[tone]}`}>
      <span className="shrink-0">{icon}</span>
      {children}
    </div>
  )
}
