'use client'

import * as React from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

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
        <GoogleMark />
        Continue with Google
      </Button>
      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="currentColor" d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.7h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.26Z" />
      <path fill="currentColor" opacity=".8" d="M12 21.5c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A10 10 0 0 0 12 21.5Z" />
      <path fill="currentColor" opacity=".6" d="M6.41 13.42A6 6 0 0 1 6.1 11.5c0-.67.11-1.31.31-1.92V7H3.07A10 10 0 0 0 2 11.5c0 1.61.39 3.14 1.07 4.5l3.34-2.58Z" />
      <path fill="currentColor" opacity=".9" d="M12 5.46c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.47 14.7 1.5 12 1.5a10 10 0 0 0-8.93 5.5l3.34 2.58C7.2 7.22 9.4 5.46 12 5.46Z" />
    </svg>
  )
}
