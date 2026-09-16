import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-pink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
})

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-pink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
})

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fg-muted',
        className,
      )}
      {...props}
    />
  )
}

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-fg focus:border-pink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
})
