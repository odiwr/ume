'use client'

import * as React from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

import { DiscordMark, GoogleMark, Info } from '@/components/ui/icons'

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
          className="flex items-start gap-3 rounded-2xl bg-blush px-4 py-3 text-sm text-fg"
          role="alert"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-pink" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
