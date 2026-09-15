'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { NAV_LINKS } from '@/lib/site/links'

export function MobileNav({ inviteHref, signedIn }: { inviteHref: string; signedIn: boolean }) {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()

  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="site-mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open ? (
        <div
          id="site-mobile-menu"
          className="absolute inset-x-0 top-full border-b border-border bg-bg/95 px-4 pb-5 pt-2 shadow-2xl backdrop-blur"
        >
          <nav className="flex flex-col" aria-label="Mobile">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={signedIn ? '/app' : '/login'}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              {signedIn ? 'Dashboard' : 'Log in'}
            </Link>
          </nav>
          <a
            href={inviteHref}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses('primary', 'lg', 'mt-3 w-full')}
          >
            Add to Discord
          </a>
        </div>
      ) : null}
    </div>
  )
}
