import Link from 'next/link'
import { BRAND } from '@ume/shared'
import { Logo } from '@/components/ui/logo'
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  githubUrl,
  supportInviteUrl,
} from '@/lib/site/links'

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
        {title}
      </h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  )
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string
  external?: boolean
  children: React.ReactNode
}) {
  const cls = 'text-sm text-fg-muted transition-colors hover:text-fg'
  if (external) {
    return (
      <li>
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {children}
        </a>
      </li>
    )
  }
  return (
    <li>
      <Link href={href} className={cls}>
        {children}
      </Link>
    </li>
  )
}

export function SiteFooter() {
  const github = githubUrl()
  const support = supportInviteUrl()
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo size={28} />
            <p className="mt-4 text-sm text-fg-muted">{BRAND.tagline}</p>
            <p className="mt-2 text-sm text-fg-subtle">
              Built for servers that would rather run a radio station than babysit a queue.
            </p>
          </div>
          <FooterColumn title="Product">
            {FOOTER_PRODUCT_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href}>
                {l.label}
              </FooterLink>
            ))}
          </FooterColumn>
          <FooterColumn title="Legal">
            {FOOTER_LEGAL_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href}>
                {l.label}
              </FooterLink>
            ))}
          </FooterColumn>
          <FooterColumn title="Community">
            {github ? (
              <FooterLink href={github} external>
                GitHub
              </FooterLink>
            ) : null}
            {support ? (
              <FooterLink href={support} external>
                Discord support
              </FooterLink>
            ) : null}
            <FooterLink href="/dmca">Report content</FooterLink>
          </FooterColumn>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {BRAND.name}. Not affiliated with Discord Inc. or any of the sites you can
            add links from.
          </p>
          <p>Your music stays in your server. Ume never sells your data.</p>
        </div>
      </div>
    </footer>
  )
}
