import * as React from 'react'
import { cn } from '@/lib/utils'

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)} {...props} />
  )
}

export function Section({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('py-16 sm:py-24', className)} {...props} />
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-pink', className)}
      {...props}
    />
  )
}

export function SectionTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl',
        className,
      )}
      {...props}
    />
  )
}

export function SectionLead({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-4 max-w-2xl text-base text-fg-muted sm:text-lg', className)} {...props} />
  )
}
