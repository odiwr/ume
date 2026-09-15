import { Bot, Globe, Music } from 'lucide-react'
import { Container, Eyebrow, Section, SectionLead, SectionTitle } from '@/components/site/container'

const STEPS = [
  {
    icon: Bot,
    title: 'Add Ume',
    body: 'Invite the bot with one click. Join a voice channel and run /home so Ume knows where to live.',
  },
  {
    icon: Globe,
    title: 'Claim your server on the web',
    body: 'Sign in with Discord and pick the server you own or administer. Prefer a token? Run /reload and paste the single-use Ume token instead.',
  },
  {
    icon: Music,
    title: 'Drop songs into a playlist',
    body: 'Create a playlist, drag your files in or paste YouTube links, then /play it. Give members a share link and let them fill it up.',
  },
] as const

export function HowItWorks() {
  return (
    <Section id="how-it-works" className="scroll-mt-16 border-y border-border bg-surface/40">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <SectionTitle>Three steps. Then it just runs.</SectionTitle>
          <SectionLead>No dashboards to babysit and no prefix to configure. Most servers are playing music within five minutes.</SectionLead>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-pink/10 text-pink">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="font-display text-3xl font-bold text-surface-3">0{i + 1}</span>
              </div>
              <h3 className="font-display mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
