'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ActionResult } from '@/lib/app/guard'

/**
 * Runs a server action inside a transition, toasts the outcome and refreshes the
 * route so server-rendered lists pick up the change.
 */
export function useAction() {
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  const run = React.useCallback(
    <T,>(
      fn: () => Promise<ActionResult<T>>,
      opts: { success?: string | ((data: T) => string | null); onSuccess?: (data: T) => void; refresh?: boolean } = {},
    ) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          try {
            const result = await fn()
            if (result.ok) {
              const msg = typeof opts.success === 'function' ? opts.success(result.data) : opts.success
              if (msg) toast.success(msg)
              opts.onSuccess?.(result.data)
              if (opts.refresh !== false) router.refresh()
            } else {
              toast.error(result.error)
            }
            resolve(result)
          } catch (err) {
            // A redirect() inside the action throws here on purpose; anything else is a real failure.
            const digest = typeof err === 'object' && err && 'digest' in err ? String((err as { digest: unknown }).digest) : ''
            if (digest.startsWith('NEXT_REDIRECT')) throw err
            toast.error(err instanceof Error ? err.message : 'Something went wrong.')
            resolve({ ok: false, error: 'failed' })
          }
        })
      }),
    [router],
  )

  return { pending, run }
}
