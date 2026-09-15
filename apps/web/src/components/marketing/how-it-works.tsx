import { Bot, Globe, Music, type LucideIcon } from 'lucide-react'
import { Container, Section, SectionLead, SectionTitle } from '@/components/site/container'

const STEPS: { icon: LucideIcon; title: string; body: string; aside: string }[] = [
  {
    icon: Bot,
    title: 'Add Ume',
    body: 'Invite the bot with one click. Join a voice channel and run /home so Ume knows where to live.',
    aside: '/home #lounge',
  },
  {
    icon: Globe,
    title: 'Claim your server on the web',
    body: 'Sign in with Discord and pick the server you own or administer. Prefer a token? Run /reload and paste the single-use Ume token instead.',
    aside: 'ume_…',
  },
  {
    icon: Music,
    title: 'Drop songs into a playlist',
    body: 'Create a playlist, drag your files in or paste a link, then /play it. Give members a share link and let them fill it up.',
    aside: '/play city-pop',
  },
]

export function HowItWorks() {
  return (
    <Section id="how-it-works" className="scroll-mt-16 border-y border-border bg-surface/40">
      <Container>
        <div className="max-w-2xl">
          <SectionTitle className="[text-wrap:balance]">
            Three steps. Then it just runs.
          </SectionTitle>
          <SectionLead className="[text-wrap:pretty]">
            No dashboards to babysit and no prefix to configure. The setup is the same for a
            five-person server and a five-thousand-person one.
          </SectionLead>
        </div>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative border-t border-border-strong pt-6">
              <div className="flex items-start justify-between gap-4">
                <span className="font-display text-5xl font-bold leading-none text-pink">
                  0{i + 1}
                </span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-fg-muted">
                  <s.icon className="size-5" aria-hidden />
                </span>
              </div>
              <h3 className="font-display mt-6 text-xl font-semibold [text-wrap:balance]">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted [text-wrap:pretty]">
                {s.body}
              </p>
              <code className="mt-4 inline-block rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-fg-muted">
                {s.aside}
              </code>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
