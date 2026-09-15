import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: { default: 'Founder console', template: '%s · Ume console' },
  robots: { index: false, follow: false },
}

/**
 * Shell shared by /ceo/login and the gated console. Authorization happens in the
 * (console) layout so the login page itself never redirects in a loop. This is the
 * only Toaster under /ceo; pages and actions call `toast()` from sonner directly.
 */
export default function CeoRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
