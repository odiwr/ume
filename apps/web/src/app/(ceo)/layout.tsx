import type { Metadata } from 'next'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: { default: 'Founder console', template: '%s · Ume console' },
  robots: { index: false, follow: false },
}

/**
 * Shell shared by /ceo/login and the gated console. Authorization happens in the
 * (console) layout so the login page itself never redirects in a loop.
 */
export default function CeoRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: '!bg-surface-2 !border-border-strong !text-fg !rounded-xl',
            description: '!text-fg-muted',
            success: '!border-success/40',
            error: '!border-danger/40',
          },
        }}
      />
    </>
  )
}
