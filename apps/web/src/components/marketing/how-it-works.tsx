import { Container, Section, SectionTitle } from '@/components/site/container'

const STEPS = [
  {
    title: 'Add Ume to your server.',
    body: 'Add Ume to Discord, then sign in here to claim a server you own or administer.',
  },
  {
    title: 'Create a playlist.',
    body: 'Create a playlist. Drop in your audio files or add a link, then invite friends to contribute.',
  },
  {
    title: 'Set a channel and play.',
    body: 'Join a voice channel, set it as home, and play your playlist. Ume takes it from there.',
  },
]

export function HowItWorks() {
  return (
    <Section id="how-it-works" className="scroll-mt-20">
      <Container>
        <div className="mx-auto max-w-4xl text-center">
          <SectionTitle>Get started in three steps.</SectionTitle>
        </div>
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="pt-6">
              <span className="font-display text-5xl font-medium text-sage">0{i + 1}</span>
              <h3 className="font-display mt-6 text-2xl font-medium">{s.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-fg-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
