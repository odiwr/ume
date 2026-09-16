import * as React from 'react'
import Link from 'next/link'
import { Container } from './container'

export interface LegalSectionSpec {
  id: string
  title: string
}

export function LegalPage({
  title,
  intro,
  effectiveDate,
  sections,
  children,
}: {
  title: string
  intro: string
  effectiveDate: string
  sections: LegalSectionSpec[]
  children: React.ReactNode
}) {
  return (
    <Container className="py-14 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
            On this page
          </p>
          <nav aria-label="Sections" className="flex flex-col gap-1">
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex min-h-11 items-center rounded-lg px-2 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <span className="mr-2 tabular-nums text-fg-subtle">{i + 1}.</span>
                {s.title}
              </a>
            ))}
          </nav>
          <div className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-subtle lg:flex-col">
            <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-fg">
              Terms
            </Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-fg">
              Privacy
            </Link>
            <Link href="/dmca" className="inline-flex min-h-11 items-center hover:text-fg">
              DMCA
            </Link>
          </div>
        </aside>
        <article className="min-w-0 max-w-3xl">
          <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-fg-subtle">Effective {effectiveDate}</p>
          <p className="mt-6 text-base text-fg-muted sm:text-lg">{intro}</p>
          <div className="mt-10 flex flex-col gap-12">{children}</div>
        </article>
      </div>
    </Container>
  )
}

export function LegalSection({
  id,
  index,
  title,
  children,
}: {
  id: string
  index: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        <span className="mr-2 text-pink">{index}.</span>
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4 text-base leading-7 text-fg-muted [&_a]:text-pink-soft [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:text-fg [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </section>
  )
}
