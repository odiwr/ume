'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from '@/components/ui/icons'
import { Button, buttonClasses } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6 lg:px-8">
        <Logo size={30} />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center sm:p-8">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <AlertTriangle className="size-8" aria-hidden />
          </span>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Unable to load this page.
          </h1>
          <p className="mt-3 text-sm text-fg-muted">
            Try again. If the problem continues, contact support with the reference below.
          </p>
          {error.digest ? (
            <p className="mt-3 text-xs text-fg-subtle">
              Reference{' '}
              <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-fg-muted">
                {error.digest}
              </code>
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
