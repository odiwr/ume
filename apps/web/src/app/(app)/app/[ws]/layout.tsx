import Link from 'next/link'
import { Lock } from 'lucide-react'
import { can } from '@ume/db'
import { CAP, guildIconUrl } from '@ume/shared'
import { buttonClasses } from '@/components/ui/button'
import { TopBar } from '@/components/app/top-bar'
import { WorkspaceBanners } from '@/components/app/workspace-banners'
import { WorkspaceSidebar, type SidebarNavItem } from '@/components/app/workspace-sidebar'
import { WORKSPACE_NAV, workspacePath } from '@/lib/app/nav'
import { listMyWorkspaces } from '@/lib/app/queries'
import { getWorkspaceContext } from '@/lib/app/workspace'

/**
 * Loads the workspace by its public Ume ID, resolves the signed-in user's access
 * (auto-joining through Discord role mapping when possible) and renders the shell.
 * Pages re-check access themselves; this layout is the frame, not the gate.
 */
export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const ctx = await getWorkspaceContext(umeId)

  if (!ctx.access || !ctx.isMember) {
    return (
      <div className="min-h-dvh">
        <TopBar user={ctx.user} crumbs={[{ href: '/app', label: 'Your servers' }, { label: ctx.workspace.guildName }]} />
        <main className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-20 text-center sm:px-6">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-fg-muted">
            <Lock className="size-6" aria-hidden />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-pink">No access</p>
          <h1 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl [text-wrap:pretty]">You are not a member of {ctx.workspace.guildName} on Ume.</h1>
          <p className="mt-3 text-sm text-fg-muted [text-wrap:pretty]">
            {ctx.user.discordUserId
              ? 'Access comes from the server’s Discord role mapping, a share link or an email invite. If you just joined the Discord server, reload this page; otherwise ask a Master for an invite.'
              : 'Link your Discord account from the servers page so Ume can check your roles in this server, or ask a Master for an invite link.'}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/app" className={buttonClasses('primary', 'md')}>
              Back to your servers
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const { access, workspace, user } = ctx
  const nav: SidebarNavItem[] = WORKSPACE_NAV.filter((item) => item.cap === null || can(access, item.cap)).map((item) => ({
    key: item.key,
    label: item.label,
    href: workspacePath(umeId, item.segment),
    exact: item.segment === '',
  }))
  const mine = await listMyWorkspaces(user.id)
  const switcher = mine.map((m) => ({
    umeId: m.workspace.umeId,
    guildName: m.workspace.guildName,
    iconUrl: guildIconUrl(m.workspace.guildId, m.workspace.guildIcon, 64),
  }))

  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:flex-row">
      <WorkspaceSidebar
        current={{
          umeId,
          guildName: workspace.guildName,
          iconUrl: guildIconUrl(workspace.guildId, workspace.guildIcon, 64),
          roleName: access.isOwner ? 'Owner' : (access.role?.name ?? 'Member'),
        }}
        nav={nav}
        workspaces={switcher}
        user={user}
      />
      <main className="min-w-0 flex-1">
        <WorkspaceBanners workspace={workspace} canManageSettings={can(access, CAP.MANAGE_SETTINGS)} />
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
