import * as React from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'default' | 'pink' | 'sage' | 'beige' | 'success' | 'warning' | 'danger'

const tones: Record<BadgeTone, string> = {
  default: 'bg-surface-3 text-fg-muted border-border',
  pink: 'bg-pink/15 text-pink-soft border-pink/30',
  sage: 'bg-sage/15 text-sage border-sage/30',
  beige: 'bg-beige/15 text-beige border-beige/30',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
}

export function Badge({ tone = 'default', className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}
      {...props}
    />
  )
}
