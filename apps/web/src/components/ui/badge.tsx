import * as React from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'default' | 'pink' | 'sage' | 'beige' | 'success' | 'warning' | 'danger'

const tones: Record<BadgeTone, string> = {
  default: 'bg-surface-3 text-fg-muted',
  pink: 'bg-pink/15 text-pink-soft',
  sage: 'bg-sage/15 text-sage',
  beige: 'bg-beige/15 text-beige',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
}

export function Badge({
  tone = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
