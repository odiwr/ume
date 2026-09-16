import Link from 'next/link'
import Image from 'next/image'
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
      <ul className="flex flex-col">{children}</ul>
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
  const cls =
    'inline-flex min-h-11 items-center text-sm text-fg-muted transition-colors hover:text-fg'
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
    <footer className="bg-surface/40">
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo size={28} />
            <p className="mt-4 text-sm text-fg-muted">{BRAND.tagline}</p>
            <p className="mt-2 text-sm text-fg-subtle">
              Upload music, build playlists, and listen in Discord.
            </p>
            <a
              href="https://odiwr.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Built by odiwr (opens in a new tab)"
              className="mt-5 inline-flex min-h-11 min-w-11 items-center rounded-lg transition-opacity hover:opacity-75"
            >
              <Image src="/brand/odiwr-tag.svg" alt="Built by odiwr" width={30} height={24} />
            </a>
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
        <div className="mt-10 flex flex-col pt-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {BRAND.name}. Ume is an independent service and is not affiliated with or
            endorsed by Discord Inc. or third-party content providers.
          </p>
        </div>
      </div>
    </footer>
  )
}
