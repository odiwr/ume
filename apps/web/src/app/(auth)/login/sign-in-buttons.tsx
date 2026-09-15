'use client'

import * as React from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

function DiscordMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" {...props}>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9.1-.2 13.6.2 18.1a20 20 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4c-.7.4-1.3.7-2 1l1.3 2a19.9 19.9 0 0 0 6-3c.5-5.2-.8-9.7-3.5-13.7ZM8.5 15.4c-1.2 0-2.1-1.1-2.1-2.4s1-2.4 2.1-2.4c1.2 0 2.2 1.1 2.1 2.4 0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s1-2.4 2.1-2.4c1.2 0 2.2 1.1 2.1 2.4 0 1.3-.9 2.4-2.1 2.4Z" />
    </svg>
  )
}

function GoogleMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
      />
    </svg>
  )
}

type Provider = 'discord' | 'google'

export function SignInButtons({ next }: { next: string }) {
  const [busy, setBusy] = React.useState<Provider | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function start(provider: Provider) {
    setBusy(provider)
    setError(null)
    try {
      const res = await authClient.signIn.social({
        provider,
        callbackURL: next,
        errorCallbackURL: `/login?error=oauth&next=${encodeURIComponent(next)}`,
      })
      if (res.error) {
        setError(res.error.message ?? 'Sign-in failed. Please try again.')
        setBusy(null)
      }
      // On success the browser is redirected to the provider; keep the spinner.
    } catch {
      setError('Could not reach the sign-in service. Check your connection and try again.')
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
        onClick={() => start('discord')}
        loading={busy === 'discord'}
        disabled={busy !== null}
        className="w-full"
      >
        {busy !== 'discord' ? <DiscordMark className="size-5" /> : null}
        Sign in with Discord
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        onClick={() => start('google')}
        loading={busy === 'google'}
        disabled={busy !== null}
        className="w-full"
      >
        {busy !== 'google' ? <GoogleMark className="size-5" /> : null}
        Continue with Google
      </Button>
      {error ? (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
