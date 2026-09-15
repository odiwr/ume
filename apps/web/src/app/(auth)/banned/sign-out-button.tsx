'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await authClient.signOut()
        } finally {
          router.replace('/')
          router.refresh()
        }
      }}
    >
      {!busy ? <LogOut className="size-4" /> : null}
      Sign out
    </Button>
  )
}
