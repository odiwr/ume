import type { Metadata } from 'next'
import { COMMAND_PREFIX, DANGER_CONFIRM_TTL_MS } from '@ume/shared'
import { Container, Section, SectionLead } from '@/components/site/container'
import { Badge } from '@/components/ui/badge'
import {
  COMMAND_CATEGORIES,
  CommandRow,
  commandsByCategory,
} from '@/components/marketing/command-list'

export const metadata: Metadata = {
  title: 'Commands',
  description:
    'Every Ume command: slash form, ~ alias, where it works (server or DM) and who can run it. Reload, reset, purge, home, add, play and more.',
  alternates: { canonical: '/commands' },
}

export default function CommandsPage() {
  const groups = commandsByCategory()
  return (
    <>
      <Container className="pb-4 pt-16 sm:pt-24">
        <div className="max-w-2xl">
          <h1 className="font-display text-5xl font-medium leading-[1.1] sm:text-6xl">
            Discord commands.
          </h1>
          <SectionLead>
            Type a slash command in Discord. Setup replies are private. The{' '}
            <code className="font-mono text-fg">{COMMAND_PREFIX}</code> prefix is an alias with the
            same names.
          </SectionLead>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-sage-light p-5">
            <Badge tone="sage">Server</Badge>
            <p className="mt-3 text-sm text-fg-muted">
              Runs inside your Discord server. Use the slash form;{' '}
              <code className="font-mono text-fg">{COMMAND_PREFIX}</code> only works here if your
              admin enabled the Message Content intent for the bot.
            </p>
          </div>
          <div className="rounded-2xl bg-blush p-5">
            <Badge tone="beige">DM or server</Badge>
            <p className="mt-3 text-sm text-fg-muted">
              Run setup commands privately in your server, or use the{' '}
              <code className="font-mono text-fg">{COMMAND_PREFIX}</code> form in a DM. Ume asks you
              to choose a server when needed.
            </p>
          </div>
          <div className="rounded-2xl bg-surface-2 p-5">
            <Badge tone="default">Server or DM</Badge>
            <p className="mt-3 text-sm text-fg-muted">
              Works anywhere. <code className="font-mono text-fg">{COMMAND_PREFIX}</code> always
              works in DMs, no intent needed.
            </p>
          </div>
        </div>
      </Container>

      {groups.map((g) => {
        const meta = COMMAND_CATEGORIES[g.category]
        return (
          <Section key={g.category} id={g.category} className="scroll-mt-20 py-10 sm:py-14">
            <Container>
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-semibold tracking-tight">{meta.title}</h2>
                <p className="mt-2 text-sm text-fg-muted">{meta.blurb}</p>
                {g.category === 'setup' ? (
                  <p className="mt-2 text-sm text-fg-muted">
                    <code className="font-mono text-fg">{COMMAND_PREFIX}reset</code> and{' '}
                    <code className="font-mono text-fg">{COMMAND_PREFIX}purge</code> reply with a
                    six-character code that is valid for {DANGER_CONFIRM_TTL_MS / 60_000} minutes;
                    nothing happens until you send{' '}
                    <code className="font-mono text-fg">{COMMAND_PREFIX}confirm CODE</code>.
                  </p>
                ) : null}
              </div>
              <ul className="mt-6 grid gap-4 lg:grid-cols-2">
                {g.commands.map((c) => (
                  <CommandRow key={c.name} command={c} />
                ))}
              </ul>
            </Container>
          </Section>
        )
      })}

      <Section className="py-10 sm:py-14">
        <Container>
          <div className="rounded-2xl bg-blush p-6 text-sm text-fg-muted sm:p-8">
            <h2 className="font-display text-lg font-semibold text-fg">
              About the {COMMAND_PREFIX} prefix
            </h2>
            <p className="mt-2">
              The Message Content setting is off by default. If you self-host and enable it, the{' '}
              <code className="font-mono text-fg">{COMMAND_PREFIX}</code> prefix also works in
              server channels. It always works in DMs.
            </p>
          </div>
        </Container>
      </Section>
    </>
  )
}
