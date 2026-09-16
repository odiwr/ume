import * as React from 'react'
import { cn } from '@/lib/utils'

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12', className)} {...props} />
  )
}

export function Section({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('py-16 sm:py-24 lg:py-28', className)} {...props} />
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted',
        className,
      )}
      {...props}
    />
  )
}

export function SectionTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'font-display text-4xl font-medium leading-[1.12] text-fg sm:text-5xl',
        className,
      )}
      {...props}
    />
  )
}

export function SectionLead({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('mt-4 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg', className)}
      {...props}
    />
  )
}
