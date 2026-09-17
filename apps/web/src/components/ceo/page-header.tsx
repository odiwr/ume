import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="mb-2 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
          >
            <ChevronLeft className="size-3.5" /> {back.label}
          </Link>
        ) : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {title}
        </h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Section({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/** Key / value list for detail pages. */
export function KeyValue({
  items,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode }>
  className?: string
}) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            {it.label}
          </dt>
          <dd className="mt-0.5 break-words text-sm text-fg">
            {it.value ?? <span className="text-fg-subtle">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Small link-style filter chips (server-rendered). */
export function FilterChips({
  basePath,
  current,
  options,
  param = 'status',
  extra,
}: {
  basePath: string
  current: string | null
  options: Array<{ value: string | null; label: string; count?: number }>
  param?: string
  extra?: Record<string, string | undefined>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const sp = new URLSearchParams()
        for (const [k, v] of Object.entries(extra ?? {})) if (v) sp.set(k, v)
        if (o.value) sp.set(param, o.value)
        const qs = sp.toString()
        const active = (o.value ?? null) === current
        return (
          <Link
            key={o.label}
            href={qs ? `${basePath}?${qs}` : basePath}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-blush text-pink-soft'
                : 'bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg',
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span className="tabular-nums opacity-70">{o.count}</span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
