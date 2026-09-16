'use client'
import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: '!rounded-xl !border !border-border !bg-surface-2 !text-fg !shadow-xl',
          description: '!text-fg-muted',
          success: '[&_svg]:!text-success',
          error: '[&_svg]:!text-danger',
        },
      }}
    />
  )
}
