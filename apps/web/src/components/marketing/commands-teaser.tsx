import { ArrowUpRight } from '@/components/ui/icons'
import { Container, Section, SectionLead, SectionTitle } from '@/components/site/container'
import { FillLink } from '@/components/ui/fill-link'

export function CommandsTeaser() {
  return (
    <Section id="commands">
      <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionTitle>
            Play, skip, pause.
            <br />
            Right in Discord.
          </SectionTitle>
          <SectionLead>
            Start a playlist, skip a track, or see what’s on. Use slash commands without leaving
            your voice chat.
          </SectionLead>
          <FillLink href="/commands" className="mt-7">
            Explore the commands <ArrowUpRight className="size-4" aria-hidden />
          </FillLink>
        </div>
        <div className="rounded-3xl bg-surface-2 p-6 sm:p-8">
          <dl className="">
            {[
              { name: '/play', desc: 'Play a playlist.' },
              { name: '/skip', desc: 'Skip the current track.' },
              { name: '/np', desc: 'Show the current track.' },
            ].map((c) => (
              <div key={c.name} className="flex flex-wrap items-center justify-between gap-3 py-5">
                <dt className="rounded-md bg-surface px-3 py-1.5 font-mono text-sm text-pink">
                  {c.name}
                </dt>
                <dd className="text-sm text-fg-muted">{c.desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </Section>
  )
}
