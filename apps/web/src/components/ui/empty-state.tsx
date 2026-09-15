import * as React from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="flex size-12 items-center justify-center rounded-2xl bg-pink/10 text-pink">{icon}</div> : null}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description ? <p className="max-w-md text-sm text-fg-muted">{description}</p> : null}
      {children ? <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  )
}
