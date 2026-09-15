import * as React from 'react'
import { cn } from '@/lib/utils'

export interface StatTileProps {
  label: string
  value: React.ReactNode
  /** Small secondary line under the value (e.g. "12 connected · 4 active"). */
  detail?: React.ReactNode
  icon?: React.ReactNode
  tone?: 'default' | 'pink' | 'warning' | 'danger' | 'success'
  href?: string
  className?: string
}

const toneRing: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: '',
  pink: 'border-pink/40',
  warning: 'border-warning/40',
  danger: 'border-danger/40',
  success: 'border-success/40',
}

const toneIcon: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'bg-surface-3 text-fg-muted',
  pink: 'bg-pink/15 text-pink-soft',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  success: 'bg-success/15 text-success',
}

/** A KPI tile: the number is the message; everything else is quiet. */
export function StatTile({ label, value, detail, icon, tone = 'default', className }: StatTileProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-4', toneRing[tone], className)}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold tabular-nums leading-tight text-fg">{value}</p>
        {detail ? <p className="mt-1 text-xs text-fg-muted">{detail}</p> : null}
      </div>
      {icon ? <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-xl', toneIcon[tone])}>{icon}</span> : null}
    </div>
  )
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>
}
