import Link from 'next/link'
import { SiteHeader } from '@/components/site/header'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader accountActions={false} />
      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-12">
        <div className="auth-art relative isolate hidden h-full min-h-[560px] flex-col justify-end overflow-hidden rounded-[2rem] bg-sage-light p-12 lg:flex">
          <div className="auth-wave" aria-hidden />
          <div className="relative z-10">
            <p className="font-display text-6xl font-medium leading-[1.08]">Manage your music.</p>
            <p className="mt-6 max-w-sm text-lg text-fg-muted">
              Manage playlists, upload tracks, and invite members to your servers.
            </p>
          </div>
        </div>
        <div className="flex justify-center">{children}</div>
      </main>
      <footer className="mx-auto flex w-full max-w-7xl gap-5 px-5 py-5 text-sm text-fg-muted sm:px-8 lg:px-12">
        {['Terms', 'Privacy', 'DMCA'].map((label) => (
          <Link
            key={label}
            href={`/${label.toLowerCase()}`}
            className="inline-flex min-h-11 items-center hover:text-fg"
          >
            {label}
          </Link>
        ))}
      </footer>
    </div>
  )
}
