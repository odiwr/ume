'use client'
import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: '!rounded-xl !border-0 !bg-surface !text-fg !shadow-xl',
          description: '!text-fg-muted',
          success: '[&_svg]:!text-success',
          error: '[&_svg]:!text-danger',
        },
      }}
    />
  )
}
