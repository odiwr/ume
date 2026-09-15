import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { UserMenu, type MenuUser } from '@/components/app/user-menu'
import { cn } from '@/lib/utils'

/** Header for the account-level pages (/app, /app/new, /app/claim). */
export function TopBar({ user, crumbs, className }: { user: MenuUser; crumbs?: Array<{ href?: string; label: string }>; className?: string }) {
  return (
    <header className={cn('sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur', className)}>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Logo size={28} href="/app" />
          {crumbs?.length ? (
            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm text-fg-muted sm:flex">
              {crumbs.map((c, i) => (
                <span key={c.label} className="flex items-center gap-1.5">
                  <span aria-hidden className="text-fg-subtle">/</span>
                  {c.href ? (
                    <Link href={c.href} className="truncate hover:text-fg">
                      {c.label}
                    </Link>
                  ) : (
                    <span className={cn('truncate', i === crumbs.length - 1 ? 'text-fg' : '')}>{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
        </div>
        <UserMenu user={user} compact />
      </div>
    </header>
  )
}
