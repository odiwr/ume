import Link from 'next/link'
import { Logo } from '@/components/ui/logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="bg-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" aria-hidden />
      <div
        className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]"
        aria-hidden
      />
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo size={30} />
        <Link href="/" className="text-sm text-fg-muted hover:text-fg">
          Back to site
        </Link>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        {children}
      </main>
      <footer className="relative mx-auto flex w-full max-w-6xl flex-wrap gap-x-4 gap-y-1 px-4 py-6 text-xs text-fg-subtle sm:px-6 lg:px-8">
        <Link href="/terms" className="hover:text-fg">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-fg">
          Privacy
        </Link>
        <Link href="/dmca" className="hover:text-fg">
          DMCA
        </Link>
      </footer>
    </div>
  )
}
