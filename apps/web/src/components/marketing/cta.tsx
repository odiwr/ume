import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/site/container'
import { buttonClasses } from '@/components/ui/button'

export function FinalCta({ inviteHref }: { inviteHref: string }) {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] border border-pink/30 bg-surface px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="bg-glow pointer-events-none absolute inset-0" aria-hidden />
          <Image
            src="/brand/ume-logo.svg"
            alt=""
            width={96}
            height={96}
            className="relative mx-auto size-16 opacity-90 sm:size-20"
          />
          <h2 className="font-display relative mt-6 text-3xl font-bold tracking-tight sm:text-5xl">
            Give your server a station.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base text-fg-muted sm:text-lg">
            Add Ume, claim your server, drop in a playlist. The first gigabyte is free, and nobody has to press play ever
            again.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={inviteHref} target="_blank" rel="noopener noreferrer" className={buttonClasses('primary', 'lg')}>
              Add Ume to Discord
              <ArrowRight className="size-4" />
            </a>
            <Link href="/commands" className={buttonClasses('outline', 'lg')}>
              Read the commands
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
