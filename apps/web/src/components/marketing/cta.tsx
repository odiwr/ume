import Link from 'next/link'
import { ArrowUpRight, HeadphonesFilled } from '@/components/ui/icons'
import { PLANS, formatBytes } from '@ume/shared'
import { Container } from '@/components/site/container'
import { buttonClasses } from '@/components/ui/button'

export function FinalCta({ inviteHref }: { inviteHref: string }) {
  return (
    <section className="pb-16 pt-6 sm:pb-24">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] bg-sage-light px-6 py-14 text-center sm:px-12 sm:py-20">
          <HeadphonesFilled className="mx-auto size-9 text-sage" aria-hidden />
          <h2 className="font-display mt-6 text-4xl font-medium leading-[1.1] sm:text-6xl">
            Add music
            <br />
            to your server.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base text-fg-muted sm:text-lg">
            Add Ume, claim your server, and create a playlist.
            <br />
            Your first {formatBytes(PLANS[0]!.storageBytes)} is free.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={inviteHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses('primary', 'lg')}
            >
              Add Ume to Discord <ArrowUpRight className="size-4" aria-hidden />
            </a>
            <Link href="/login" className={buttonClasses('ghost', 'lg')}>
              Already have Ume? Log in
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
