import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Disc3 } from '@/components/ui/icons'
import { Logo } from '@/components/ui/logo'
import { buttonClasses } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false },
}

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6 lg:px-8">
        <Logo size={30} />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md rounded-2xl bg-surface-2 p-6 text-center sm:p-8">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-pink/10 text-pink">
            <Disc3 className="size-8 animate-[spin_6s_linear_infinite]" aria-hidden />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-pink">404</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Page not found.
          </h1>
          <p className="mt-3 text-sm text-fg-muted">
            This page may have moved, or the link may have expired.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className={buttonClasses('primary', 'md')}>
              <ArrowLeft className="size-4" />
              Back to Ume
            </Link>
            <Link href="/app" className={buttonClasses('outline', 'md')}>
              Open dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
