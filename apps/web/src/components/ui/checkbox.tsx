'use client'
import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

export function Checkbox({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md bg-border transition-colors hover:bg-border-strong/60 data-[state=checked]:bg-pink disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-bg">
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/** Checkbox with a label and optional description, laid out for forms. */
export function CheckboxField({
  id,
  label,
  description,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Checkbox id={id} className="mt-0.5" {...props} />
      <label htmlFor={id} className="cursor-pointer text-sm leading-5 text-fg">
        {label}
        {description ? (
          <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>
        ) : null}
      </label>
    </div>
  )
}
