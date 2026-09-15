import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
  eyebrow?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg">
            <ChevronLeft className="size-3.5" /> {back.label}
          </Link>
        ) : null}
        {eyebrow ? <div className="mb-1 text-xs font-medium text-fg-muted">{eyebrow}</div> : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl [text-wrap:pretty]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-fg-muted [text-wrap:pretty]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Section({
  id,
  title,
  description,
  children,
  actions,
  className,
}: {
  id?: string
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('scroll-mt-24 space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
          {description ? <p className="max-w-2xl text-sm text-fg-muted [text-wrap:pretty]">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/** Inline notice used for warnings and errors inside pages. */
export function Notice({
  tone = 'warning',
  children,
  className,
  icon,
}: {
  tone?: 'warning' | 'danger' | 'info' | 'success'
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}) {
  const tones = {
    warning: 'border-warning/30 bg-warning/10 text-warning',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    info: 'border-border bg-surface-2 text-fg-muted',
    success: 'border-success/30 bg-success/10 text-success',
  }
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm [text-wrap:pretty]', tones[tone], className)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
