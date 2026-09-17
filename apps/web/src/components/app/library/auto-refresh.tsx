'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'

/**
 * While any track is still pending or processing, re-fetch the server-rendered page
 * every `intervalMs` so status pills update without a manual reload. Pauses when the
 * tab is hidden.
 */
export function AutoRefresh({
  active,
  intervalMs = 5_000,
}: {
  active: boolean
  intervalMs?: number
}) {
  const router = useRouter()
  React.useEffect(() => {
    if (!active) return
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const id = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [active, intervalMs, router])
  return null
}
