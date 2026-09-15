'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, LayoutGrid, LogOut, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/app/avatar'
import { cn } from '@/lib/utils'

/** Loose on purpose: Better Auth types the extra Discord fields as optional. */
export interface MenuUser {
  name: string
  email: string
  image?: string | null
  discordUsername?: string | null
  discordUserId?: string | null
  discordAvatar?: string | null
}

export function UserMenu({ user, compact, className }: { user: MenuUser; compact?: boolean; className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-fg transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2',
          compact ? '' : 'w-full',
          className,
        )}
        aria-label="Account menu"
      >
        <UserAvatar user={user} size={28} />
        {!compact ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-fg-muted">{user.discordUsername ? `@${user.discordUsername}` : user.email}</span>
          </span>
        ) : null}
        <ChevronDown className="size-4 shrink-0 text-fg-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} className="w-56">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block truncate text-sm font-medium text-fg">{user.name}</span>
          <span className="block truncate text-xs font-normal text-fg-muted">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app">
            <LayoutGrid className="size-4" /> My servers
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/new">
            <Plus className="size-4" /> Add a server
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={busy}
          onSelect={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              await authClient.signOut()
              router.push('/login')
              router.refresh()
            } catch {
              toast.error('Could not sign out. Try again.')
              setBusy(false)
            }
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
