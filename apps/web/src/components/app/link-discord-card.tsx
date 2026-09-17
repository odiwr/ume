'use client'
import * as React from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { DiscordMark } from '@/components/ui/icons'

/**
 * Shown when the signed-in account has no Discord identity yet (Google sign-in, or an
 * email invite). Linking is what turns "a login" into "a person Discord can vouch for".
 */
export function LinkDiscordCard({
  callbackURL = '/app',
  mode = 'link',
}: {
  callbackURL?: string
  mode?: 'link' | 'reauth'
}) {
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
    <Card className="bg-blush">
      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">
            {mode === 'link' ? 'Connect your Discord account' : 'Sign in with Discord again'}
          </h2>
          <p className="mt-1 text-sm text-fg-muted [text-wrap:pretty]">
            {mode === 'link'
              ? 'Needed to claim a server or join through Discord roles. Ume never posts on your behalf.'
              : 'Your Discord session expired, so Ume cannot read your server list.'}
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
