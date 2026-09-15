import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'

export const dynamic = 'force-dynamic'

/**
 * Everything under /app is per-user and never cached. Each page authorizes itself
 * (requireUser / requireWorkspacePage); this layout only mounts the shared client
 * providers once.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  )
}
