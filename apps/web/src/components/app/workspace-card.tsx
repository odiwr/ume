import Link from 'next/link'
import { ArrowRight, Crown } from '@/components/ui/icons'
import { effectiveQuotaBytes, type Workspace } from '@ume/db'
import { getPlan, guildIconUrl } from '@ume/shared'
import { Badge } from '@/components/ui/badge'
import { GuildIcon } from '@/components/app/avatar'
import { StorageBar } from '@/components/app/storage-bar'
import { workspaceStatusTone } from '@/lib/app/format'
import { isBotOnline } from '@/lib/app/workspace'

export function WorkspaceCard({ workspace, roleName, isOwner }: { workspace: Workspace; roleName: string; isOwner: boolean }) {
  const status = workspaceStatusTone(workspace.status)
  const plan = getPlan(workspace.plan)
  const online = isBotOnline(workspace)
  return (
    <Link
      href={`/app/${workspace.umeId}`}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:border-pink"
    >
      <div className="flex items-start gap-3">
        <GuildIcon name={workspace.guildName} src={guildIconUrl(workspace.guildId, workspace.guildIcon, 96)} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-semibold">{workspace.guildName}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
            {isOwner ? <Crown className="size-3 text-pink" aria-hidden /> : null}
            {roleName}
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <span className={online ? 'size-1.5 rounded-full bg-success' : 'size-1.5 rounded-full bg-fg-subtle'} aria-hidden />
              {online ? 'Bot online' : 'Bot offline'}
            </span>
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={status.tone}>{status.label}</Badge>
        <Badge tone={plan.priceUsdMonthly > 0 ? 'pink' : 'default'}>{plan.name}</Badge>
      </div>
      <StorageBar used={workspace.storageUsedBytes} quota={effectiveQuotaBytes(workspace)} compact />
    </Link>
  )
}
