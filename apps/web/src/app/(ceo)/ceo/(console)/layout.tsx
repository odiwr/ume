import { requireCeo } from '@/lib/session'
import { CeoSidebar } from '@/components/ceo/sidebar'

export const dynamic = 'force-dynamic'

/**
 * Every console render passes requireCeo(): session + allow-listed email + Google
 * account + verified email. The proxy only checks that a session cookie exists.
 */
export default async function CeoConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCeo()
  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:flex-row">
      <CeoSidebar email={session.user.email} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
