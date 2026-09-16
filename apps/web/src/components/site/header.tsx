import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowRight } from '@/components/ui/icons'
import { FillLink } from '@/components/ui/fill-link'
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

export function SiteHeader({ accountActions = true }: { accountActions?: boolean }) {
  const invite = inviteUrl()
  return (
    <header className="relative z-40 bg-bg">
      <div className="relative mx-auto flex h-24 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Logo size={30} />

        <nav
          className={`hidden items-center gap-1 md:flex ${accountActions ? '' : 'ml-auto'}`}
          aria-label="Primary"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {accountActions ? (
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
            <FillLink href={invite} external>
              Add to Discord <ArrowRight className="size-4" />
            </FillLink>
          </div>
        ) : null}

        {accountActions ? (
          <Suspense fallback={<MobileNav inviteHref={invite} signedIn={false} />}>
            <MobileNavWithSession inviteHref={invite} />
          </Suspense>
        ) : (
          <MobileNav inviteHref="" signedIn={false} accountActions={false} />
        )}
      </div>
    </header>
  )
}
