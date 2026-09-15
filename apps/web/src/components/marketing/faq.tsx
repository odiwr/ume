import { ChevronDown } from 'lucide-react'
import { Container, Eyebrow, Section, SectionLead, SectionTitle } from '@/components/site/container'

export interface FaqItem {
  q: string
  a: React.ReactNode
}

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-4 open:bg-surface-2/40 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <ChevronDown className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3 text-sm leading-relaxed text-fg-muted [&_a]:text-pink-soft [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-fg">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  )
}

export function FaqSection({
  id = 'faq',
  eyebrow = 'FAQ',
  title,
  lead,
  items,
}: {
  id?: string
  eyebrow?: string
  title: string
  lead?: string
  items: FaqItem[]
}) {
  return (
    <Section id={id} className="scroll-mt-16">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <SectionTitle>{title}</SectionTitle>
          {lead ? <SectionLead>{lead}</SectionLead> : null}
        </div>
        <FaqList items={items} />
      </Container>
    </Section>
  )
}
