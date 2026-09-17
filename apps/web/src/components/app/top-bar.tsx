import { Logo } from '@/components/ui/logo'
import { UserMenu, type MenuUser } from '@/components/app/user-menu'
import { cn } from '@/lib/utils'

/** Header for the account-level pages (/app, /app/new, /app/claim). The logo links home. */
export function TopBar({ user, className }: { user: MenuUser; className?: string }) {
  return (
    <header className={cn('relative z-30 bg-bg', className)}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo size={28} href="/app" />
        <UserMenu user={user} compact />
      </div>
    </header>
  )
}
