import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { COMMANDS } from '@ume/shared'
import { Container, Eyebrow, Section, SectionLead, SectionTitle } from '@/components/site/container'
import { buttonClasses } from '@/components/ui/button'
import { CommandRow } from './command-list'

const TEASER = ['play', 'add', 'np', 'home', 'reload', 'purge']

export function CommandsTeaser() {
  const picks = TEASER.map((n) => COMMANDS.find((c) => c.name === n)).filter((c): c is NonNullable<typeof c> => !!c)
  return (
    <Section id="commands">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Eyebrow>Commands</Eyebrow>
            <SectionTitle>Slash commands first. A tilde if you want it.</SectionTitle>
            <SectionLead>
              Every command is a slash command with an ephemeral reply, so setup commands stay invisible to members who
              should not see them. The <code className="font-mono text-fg">~</code> alias works in DMs always.
            </SectionLead>
          </div>
          <Link href="/commands" className={buttonClasses('outline', 'md', 'self-start md:self-auto')}>
            All commands
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {picks.map((c) => (
            <CommandRow key={c.name} command={c} compact />
          ))}
        </ul>
      </Container>
    </Section>
  )
}
