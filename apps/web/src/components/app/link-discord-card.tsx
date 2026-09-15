'use client'
import * as React from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function DiscordMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" {...props}>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9.1-.2 13.6.2 18.1a20 20 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4c-.7.4-1.3.7-2 1l1.3 2a19.9 19.9 0 0 0 6-3c.5-5.2-.8-9.7-3.5-13.7ZM8.5 15.4c-1.2 0-2.1-1.1-2.1-2.4s1-2.4 2.1-2.4c1.2 0 2.2 1.1 2.1 2.4 0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s1-2.4 2.1-2.4c1.2 0 2.2 1.1 2.1 2.4 0 1.3-.9 2.4-2.1 2.4Z" />
    </svg>
  )
}

/**
 * Shown when the signed-in account has no Discord identity yet (Google sign-in, or an
 * email invite). Linking is what turns "a login" into "a person Discord can vouch for".
 */
export function LinkDiscordCard({ callbackURL = '/app', mode = 'link' }: { callbackURL?: string; mode?: 'link' | 'reauth' }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const res =
        mode === 'link'
          ? await authClient.linkSocial({ provider: 'discord', callbackURL })
          : await authClient.signIn.social({ provider: 'discord', callbackURL })
      if (res.error) {
        setError(res.error.message ?? 'Discord did not complete the request. Try again.')
        setBusy(false)
      }
    } catch {
      setError('Could not reach Discord. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <Card className="border-pink/30 bg-pink/5">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{mode === 'link' ? 'Connect your Discord account' : 'Sign in with Discord again'}</h2>
          <p className="mt-1 text-sm text-fg-muted [text-wrap:pretty]">
            {mode === 'link'
              ? 'Claiming a server, joining through a Discord role and share links that require membership all need a verified Discord identity. Ume asks for your identity and server list only, and never posts on your behalf.'
              : 'Your Discord session expired, so Ume cannot read your server list right now. Signing in again refreshes it.'}
          </p>
          {error ? (
            <p className="mt-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="button" onClick={start} loading={busy} className="shrink-0">
          {!busy ? <DiscordMark className="size-4" /> : null}
          {mode === 'link' ? 'Link Discord' : 'Sign in with Discord'}
        </Button>
      </CardContent>
    </Card>
  )
}
