import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Info } from 'lucide-react'
import { getSession } from '@/lib/session'
import { safeNextPath } from '@/lib/site/safe-next'
import { SignInButtons } from './sign-in-buttons'

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Sign in to Ume with Discord to claim your server and manage its music library.',
  robots: { index: false },
}

const ERRORS: Record<string, string> = {
  oauth: 'Discord or Google did not complete the sign-in. Nothing was changed; try again.',
  access_denied: 'You cancelled the sign-in on the provider’s page.',
  signup_disabled: 'New sign-ups are currently paused. Try again later.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>
}) {
  const params = await searchParams
  const next = safeNextPath(params.next)

  const session = await getSession()
  if (session) {
    redirect(session.user.banned ? '/banned' : next)
  }

  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error
  const errorMessage = errorKey ? (ERRORS[errorKey] ?? 'Sign-in failed. Please try again.') : null

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border bg-surface/90 p-6 shadow-2xl backdrop-blur sm:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Log in to Ume
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Discord is the identity for everyone who manages music. Google works too, if you were
          invited by email or run the console.
        </p>

        {errorMessage ? (
          <p
            className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6">
          <SignInButtons next={next} />
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-fg-muted">
          <Info className="mt-0.5 size-3.5 shrink-0 text-pink" aria-hidden />
          <p>
            We ask Discord for your identity, email and server list so we can show the servers you
            own or administer. We never post on your behalf.
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-fg-subtle">
        By continuing you agree to the{' '}
        <Link href="/terms" className="text-fg-muted underline underline-offset-4 hover:text-fg">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-fg-muted underline underline-offset-4 hover:text-fg">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}
