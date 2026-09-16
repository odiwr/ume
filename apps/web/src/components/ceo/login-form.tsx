'use client'

import * as React from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { GoogleMark } from '@/components/ui/icons'

export function CeoLoginForm() {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  return (
    <div className="space-y-3">
      <Button
        size="lg"
        className="w-full"
        loading={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            const res = await authClient.signIn.social({ provider: 'google', callbackURL: '/ceo' })
            if (res.error) {
              setError(res.error.message ?? 'Google sign-in failed.')
              setBusy(false)
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Google sign-in failed.')
            setBusy(false)
          }
        }}
      >
        <GoogleMark className="size-4" />
        Continue with Google
      </Button>
      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}
    </div>
  )
}
