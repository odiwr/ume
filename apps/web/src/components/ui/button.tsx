import * as React from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-fg text-bg hover:bg-sage',
  secondary: 'border border-border-strong bg-surface text-fg hover:bg-surface-2',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
  outline: 'border border-border-strong bg-transparent text-fg hover:bg-surface-2',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 text-sm rounded-full gap-1.5',
  md: 'min-h-11 px-5 text-sm rounded-full gap-2',
  lg: 'min-h-12 px-6 py-3 text-base rounded-full gap-2',
  icon: 'h-11 w-11 rounded-full',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  )
})

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn(
    'inline-flex items-center justify-center font-semibold transition-colors whitespace-nowrap',
    variants[variant],
    sizes[size],
    className,
  )
}
