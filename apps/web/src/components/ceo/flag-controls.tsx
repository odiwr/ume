'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { toggleFlagAction } from '@/lib/ceo/actions'

/**
 * A switch bound to one feature flag. Optimistic: the thumb moves immediately and
 * snaps back if the server action fails. `confirmOff` guards flags where turning
 * off changes product behaviour for every workspace (the link extractor).
 */
export function FlagToggle({
  flagKey,
  enabled,
  confirmOff,
  label,
}: {
  flagKey: string
  enabled: boolean
  confirmOff?: string
  label: string
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [optimistic, setOptimistic] = React.useState(enabled)

  React.useEffect(() => {
    setOptimistic(enabled)
  }, [enabled])

  return (
    <div className="inline-flex items-center gap-2">
      <Switch
        checked={optimistic}
        disabled={pending}
        aria-label={`${label}: ${optimistic ? 'on' : 'off'}`}
        onCheckedChange={(next) => {
          if (!next && confirmOff && !window.confirm(confirmOff)) return
          setOptimistic(next)
          const fd = new FormData()
          fd.set('key', flagKey)
          fd.set('enabled', next ? 'true' : 'false')
          startTransition(async () => {
            try {
              const result = await toggleFlagAction(fd)
              if (result.ok) {
                toast.success(result.message)
                router.refresh()
              } else {
                setOptimistic(!next)
                toast.error(result.error)
              }
            } catch (err) {
              setOptimistic(!next)
              toast.error(err instanceof Error ? err.message : 'Could not update the flag.')
            }
          })
        }}
      />
      <span
        className={
          optimistic ? 'text-xs font-semibold text-success' : 'text-xs font-semibold text-fg-subtle'
        }
      >
        {optimistic ? 'On' : 'Off'}
      </span>
    </div>
  )
}
