'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  Bell,
  DollarSign,
  Flag,
  Gavel,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  ScrollText,
  Server,
  Users,
  X,
} from '@/components/ui/icons'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { CEO_NAV, isNavActive, type CeoNavIcon } from '@/lib/ceo/nav'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

const icons: Record<CeoNavIcon, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  workspaces: Server,
  users: Users,
  storage: HardDrive,
  revenue: DollarSign,
  bot: Radio,
  flags: Flag,
  dmca: Gavel,
  notifications: Bell,
  audit: ScrollText,
}

export function CeoSidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {CEO_NAV.map((item) => {
        const Icon = icons[item.icon]
        const active = isNavActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-sage-light text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Logo size={26} href="/ceo" />
          <span className="rounded-full border border-pink/30 bg-pink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-soft">
            Founder
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="inline-flex size-11 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open ? (
        <div className="border-b border-border bg-surface p-3 lg:hidden">
          {nav}
          <div className="mt-3 border-t border-border pt-3">
            <SignedInAs email={email} />
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex items-center gap-2 px-4 pt-5 pb-4">
          <Logo size={28} href="/ceo" />
          <span className="rounded-full border border-pink/30 bg-pink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-soft">
            Founder
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3">{nav}</div>
        <div className="border-t border-border p-3">
          <SignedInAs email={email} />
        </div>
      </aside>
    </>
  )
}

function SignedInAs({ email }: { email: string }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
          Signed in
        </p>
        <p className="truncate text-xs text-fg-muted" title={email}>
          {email}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await authClient.signOut()
            router.push('/ceo/login')
            router.refresh()
          } catch {
            toast.error('Could not sign out. Try again.')
            setBusy(false)
          }
        }}
        aria-label="Sign out"
        title="Sign out"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-50"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )
}
