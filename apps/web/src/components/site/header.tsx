import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { buttonClasses } from '@/components/ui/button'
import { getSession } from '@/lib/session'
import { NAV_LINKS, inviteUrl } from '@/lib/site/links'
import { MobileNav } from './mobile-nav'

async function isSignedIn(): Promise<boolean> {
  try {
    const session = await getSession()
    return !!session
  } catch {
    return false
  }
}

async function AccountLink() {
  const signedIn = await isSignedIn()
  return (
    <Link href={signedIn ? '/app' : '/login'} className={buttonClasses('ghost', 'md')}>
      {signedIn ? 'Dashboard' : 'Log in'}
    </Link>
  )
}

async function MobileNavWithSession({ inviteHref }: { inviteHref: string }) {
  const signedIn = await isSignedIn()
  return <MobileNav inviteHref={inviteHref} signedIn={signedIn} />
}

export function SiteHeader() {
  const invite = inviteUrl()
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo size={30} />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Suspense
            fallback={
              <span className={buttonClasses('ghost', 'md', 'pointer-events-none opacity-0')}>
                Log in
              </span>
            }
          >
            <AccountLink />
          </Suspense>
          <a
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses('primary', 'md')}
          >
            Add to Discord
            <ArrowRight className="size-4" />
          </a>
        </div>

        <Suspense fallback={<MobileNav inviteHref={invite} signedIn={false} />}>
          <MobileNavWithSession inviteHref={invite} />
        </Suspense>
      </div>
    </header>
  )
}
