'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Check,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  ListMusic,
  Menu,
  Plus,
  Settings,
  Shield,
  Ticket,
  Users,
  X,
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { GuildIcon } from '@/components/app/avatar'
import { UserMenu, type MenuUser } from '@/components/app/user-menu'
import { cn } from '@/lib/utils'

export interface SidebarNavItem {
  key: string
  label: string
  href: string
  exact: boolean
}

export interface SwitcherWorkspace {
  umeId: string
  guildName: string
  iconUrl: string | null
}

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  library: ListMusic,
  members: Users,
  roles: Shield,
  invites: Ticket,
  activity: Activity,
  settings: Settings,
  billing: CreditCard,
}

export function WorkspaceSidebar({
  current,
  nav,
  workspaces,
  user,
}: {
  current: SwitcherWorkspace & { roleName: string }
  nav: SidebarNavItem[]
  workspaces: SwitcherWorkspace[]
  user: MenuUser
}) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  const links = (
    <nav className="flex flex-col gap-0.5" aria-label="Workspace">
      {nav.map((item) => {
        const Icon = icons[item.key] ?? LayoutDashboard
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-pink/15 text-pink-soft' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const switcher = <ServerSwitcher current={current} workspaces={workspaces} />

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Logo size={26} withWordmark={false} href="/app" />
          {switcher}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open ? (
        <div className="border-b border-border bg-surface p-3 lg:hidden">
          {links}
          <div className="mt-3 border-t border-border pt-3">
            <UserMenu user={user} />
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="px-4 pb-3 pt-5">
          <Logo size={28} href="/app" />
        </div>
        <div className="px-3 pb-3">{switcher}</div>
        <div className="flex-1 overflow-y-auto px-3">{links}</div>
        <div className="border-t border-border p-3">
          <UserMenu user={user} />
        </div>
      </aside>
    </>
  )
}

function ServerSwitcher({ current, workspaces }: { current: SwitcherWorkspace & { roleName: string }; workspaces: SwitcherWorkspace[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-surface-2 px-2 py-1.5 text-left transition-colors hover:border-border-strong data-[state=open]:border-border-strong"
        aria-label="Switch server"
      >
        <GuildIcon name={current.guildName} src={current.iconUrl} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{current.guildName}</span>
          <span className="block truncate text-[11px] text-fg-muted">{current.roleName}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-fg-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your servers</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.umeId} asChild>
            <Link href={`/app/${w.umeId}`}>
              <GuildIcon name={w.guildName} src={w.iconUrl} size={22} />
              <span className="min-w-0 flex-1 truncate">{w.guildName}</span>
              {w.umeId === current.umeId ? <Check className="size-4 text-pink" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/new">
            <Plus className="size-4" /> Add a server
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
