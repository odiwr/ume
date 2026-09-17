'use client'
import * as React from 'react'
import Link from 'next/link'
import { Check, CircleAlert } from '@/components/ui/icons'
import { Button, buttonClasses } from '@/components/ui/button'
import { acceptInvite } from '@/lib/app/actions/invites'

/**
 * Calls the public acceptInvite() action. On success the action redirects into the
 * workspace, so the only thing rendered here is the failure message. There is no
 * Toaster at the app root, hence the inline alert.
 */
export function AcceptInviteButton({ token, serverName }: { token: string; serverName: string }) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function accept() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await acceptInvite(token)
        // A redirect resolves without a result; only a refusal comes back as a value.
        if (result && !result.ok) setError(result.error)
      } catch (err) {
        const digest =
          typeof err === 'object' && err && 'digest' in err
            ? String((err as { digest: unknown }).digest)
            : ''
        if (digest.startsWith('NEXT_REDIRECT')) throw err
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          className="flex items-start gap-3 rounded-2xl bg-blush px-4 py-3 text-sm text-fg"
          role="alert"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-pink" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={accept} loading={pending} className="sm:min-w-48">
          {!pending ? <Check className="size-4" aria-hidden /> : null}
          Accept invite
        </Button>
        <Link href="/app" className={buttonClasses('ghost', 'lg')} aria-disabled={pending}>
          Not now
        </Link>
      </div>
      <p className="text-xs text-fg-subtle">
        Accepting adds you to {serverName}. You can leave from the members page at any time.
      </p>
    </div>
  )
}
