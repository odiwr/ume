import { Container, Section, SectionLead, SectionTitle } from '@/components/site/container'
import { FaqList, type FaqItem } from './faq-list'

export { FaqList, type FaqItem } from './faq-list'

export function FaqSection({
  id = 'faq',
  title,
  lead,
  items,
}: {
  id?: string
  title: string
  lead?: string
  items: FaqItem[]
}) {
  return (
    <Section id={id}>
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionTitle>{title}</SectionTitle>
          {lead ? <SectionLead>{lead}</SectionLead> : null}
        </div>
        <FaqList items={items} />
      </Container>
    </Section>
  )
}
