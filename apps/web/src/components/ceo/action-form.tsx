'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, type ButtonProps } from '@/components/ui/button'
import type { ActionResult } from '@/lib/ceo/actions'

type ServerAction = (formData: FormData) => Promise<ActionResult>

const PendingContext = React.createContext(false)

export interface ActionFormProps extends Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  'action' | 'onSubmit'
> {
  action: ServerAction
  /** Ask `window.confirm` with this text before submitting. */
  confirm?: string
  /** Clear the form after a successful submit. */
  resetOnSuccess?: boolean
  onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void
}

/**
 * A form that calls a CEO server action and reports the outcome with a toast.
 * Children can read the pending state through <ActionSubmit/>.
 */
export function ActionForm({
  action,
  confirm,
  resetOnSuccess,
  onSuccess,
  children,
  ...props
}: ActionFormProps) {
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()
  return (
    <PendingContext.Provider value={pending}>
      <form
        {...props}
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          if (confirm && !window.confirm(confirm)) return
          const fd = new FormData(form)
          startTransition(async () => {
            try {
              const result = await action(fd)
              if (result.ok) {
                toast.success(result.message)
                if (resetOnSuccess) form.reset()
                onSuccess?.(result)
                router.refresh()
              } else {
                toast.error(result.error)
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'The action failed.')
            }
          })
        }}
      >
        {children}
      </form>
    </PendingContext.Provider>
  )
}

export function ActionSubmit({ children, ...props }: ButtonProps) {
  const pending = React.useContext(PendingContext)
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  )
}

/** One-click action button (hidden inputs + submit) for table rows and detail pages. */
export function ActionButton({
  action,
  fields,
  confirm,
  children,
  className,
  ...button
}: {
  action: ServerAction
  fields: Record<string, string>
  confirm?: string
  children: React.ReactNode
  className?: string
} & Omit<ButtonProps, 'type' | 'children' | 'className'>) {
  return (
    <ActionForm action={action} confirm={confirm} className={className}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <ActionSubmit {...button}>{children}</ActionSubmit>
    </ActionForm>
  )
}
