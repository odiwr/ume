import Link from 'next/link'
import { ArrowDown, ArrowUpRight } from '@/components/ui/icons'
import { buttonClasses } from '@/components/ui/button'
import { LibraryPreview } from './library-preview'

export function Hero({ inviteHref }: { inviteHref: string }) {
  return (
    <section className="px-3 pt-3 sm:px-6 sm:pt-4 lg:px-8" aria-labelledby="hero-title">
      <div className="hero-panel mx-auto max-w-[1440px] overflow-hidden rounded-[2rem] px-4 pt-14 sm:px-8 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1
            id="hero-title"
            className="font-display text-[clamp(2.75rem,5.6vw,5rem)] font-medium leading-[1.05]"
          >
            Music for your
            <br />
            Discord server.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-fg-muted sm:text-lg">
            Ume stays in your Discord voice channel 24/7. Upload music, build playlists with your
            members, and control playback from Discord.
          </p>
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 min-[420px]:flex-row min-[420px]:items-center">
            <a
              href={inviteHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses('primary', 'lg')}
            >
              Add Ume to Discord <ArrowUpRight className="size-4" aria-hidden />
            </a>
            <Link
              href="/#how-it-works"
              className={buttonClasses('secondary', 'lg', 'bg-surface/80 hover:bg-surface')}
            >
              See how it works <ArrowDown className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="mt-12 sm:mt-16">
          <LibraryPreview />
        </div>
      </div>
    </section>
  )
}
