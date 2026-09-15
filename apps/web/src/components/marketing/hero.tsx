import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PLANS, formatBytes } from '@ume/shared'
import { buttonClasses } from '@/components/ui/button'
import { Container } from '@/components/site/container'

export function Hero({ inviteHref }: { inviteHref: string }) {
  const free = PLANS[0]!
  return (
    <section className="relative overflow-hidden">
      <div className="bg-glow pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden />
      <div
        className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_10%,black,transparent)]"
        aria-hidden
      />
      <Container className="relative grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-pink/30 bg-pink/10 px-3 py-1 text-xs font-semibold text-pink-soft">
            <span className="animate-eq inline-flex h-3 items-end gap-0.5 text-pink" aria-hidden>
              <span className="h-full" />
              <span className="h-full" />
              <span className="h-full" />
              <span className="h-full" />
            </span>
            Live in your voice channel, 24/7
          </span>
          <h1 className="font-display mt-6 text-[2.6rem] font-bold leading-[1.02] tracking-tight [text-wrap:balance] sm:text-6xl lg:text-7xl">
            A radio station for your Discord server.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-fg-muted [text-wrap:pretty] sm:text-xl">
            Ume lives in its own voice channel 24/7 and plays the music your members add. Drag in
            your files, paste a link, share a playlist, hand out DJ rights, never babysit a queue
            again.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={inviteHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses('primary', 'lg')}
            >
              Add Ume to Discord
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <Link href="/login" className={buttonClasses('outline', 'lg')}>
              Claim your server
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-subtle">
            <li>{formatBytes(free.storageBytes)} of music free</li>
            <li>No credit card</li>
            <li>Slash commands, no prefix setup</li>
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md pb-10 lg:max-w-none lg:pb-0">
          <div className="animate-float relative aspect-square overflow-hidden rounded-[2rem] border border-pink/30 shadow-[0_30px_120px_-30px_rgb(228_100_176/0.55)] motion-reduce:animate-none">
            <Image
              src="/brand/ume-artwork.png"
              alt="The Ume character: spiky black hair under white headphones with a star, on pink."
              width={1080}
              height={1080}
              priority
              sizes="(min-width: 1024px) 480px, 90vw"
              className="h-full w-full object-cover"
            />
          </div>
          <NowPlayingCard />
        </div>
      </Container>
    </section>
  )
}

/** A mock of the bot's now-playing state: sample data, clearly an illustration of the UI. */
function NowPlayingCard() {
  return (
    <div className="absolute -bottom-2 left-1/2 w-[min(92%,22rem)] -translate-x-1/2 rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur sm:-bottom-4 lg:-bottom-8 lg:left-auto lg:right-[-1rem] lg:translate-x-0">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-pink/15 text-pink">
          <span className="animate-eq inline-flex h-5 items-end gap-0.5" aria-hidden>
            <span className="h-full" />
            <span className="h-full" />
            <span className="h-full" />
            <span className="h-full" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Plastic Love</p>
          <p className="truncate text-xs text-fg-muted">
            Mariya Takeuchi · from <span className="text-fg">city-pop</span>
          </p>
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full w-2/5 rounded-full bg-pink" />
      </div>
      <p className="mt-2 text-[11px] text-fg-subtle">
        added by <span className="text-fg-muted">@nadia</span> · playing in #lounge
      </p>
    </div>
  )
}
