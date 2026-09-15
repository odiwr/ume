'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="bg-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" aria-hidden />
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6 lg:px-8">
        <Logo size={30} />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <AlertTriangle className="size-8" aria-hidden />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-warning">Something skipped</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Ume hit a bad frame.</h1>
          <p className="mt-3 text-sm text-fg-muted">
            The page failed to render. Your music and settings are untouched; this is a display problem, not a data one.
            Try again, and if it keeps happening tell us the reference below.
          </p>
          {error.digest ? (
            <p className="mt-3 text-xs text-fg-subtle">
              Reference <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-fg-muted">{error.digest}</code>
            </p>
          ) : null}
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" onClick={reset}>
              <RotateCcw className="size-4" />
              Try again
            </Button>
            <Link href="/" className={buttonClasses('outline', 'md')}>
              Back to Ume
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
