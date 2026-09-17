import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MapPin, ScrollText, UserRound } from '@/components/ui/icons'
import { BRAND } from '@ume/shared'
import { Container, SectionLead } from '@/components/site/container'
import { Card, CardContent } from '@/components/ui/card'
import { TakedownForm } from './takedown-form'

export const metadata: Metadata = {
  title: 'DMCA & copyright',
  description:
    'Ume’s designated DMCA agent, the takedown notice form with every 17 U.S.C. § 512(c)(3) element, and how counter-notices work.',
  alternates: { canonical: '/dmca' },
}

function agentInfo() {
  const name = process.env.DMCA_AGENT_NAME?.trim() || null
  const email = process.env.DMCA_AGENT_EMAIL?.trim() || null
  const address = process.env.DMCA_AGENT_ADDRESS?.trim() || null
  return { name, email, address, registered: !!(name && email && address) }
}

export default function DmcaPage() {
  const agent = agentInfo()
  return (
    <>
      <Container className="pb-8 pt-16 sm:pt-24">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-medium leading-tight sm:text-5xl">
            DMCA notices and counter-notices.
          </h1>
          <SectionLead>
            {BRAND.name} hosts audio that members upload to their own servers. If you own the rights
            to something that was uploaded without permission, this page is how you get it taken
            down, and how the uploader can push back.
          </SectionLead>
        </div>
      </Container>

      <Container className="grid gap-8 py-8 lg:grid-cols-[1fr_1.5fr]">
        <div className="flex flex-col gap-6">
          <Card className="border-0 bg-surface-2">
            <CardContent className="flex flex-col gap-4">
              <h2 className="font-display text-lg font-semibold">Designated agent</h2>
              {agent.registered ? (
                <dl className="flex flex-col gap-3 text-sm">
                  <div className="flex gap-3">
                    <UserRound className="mt-0.5 size-4 shrink-0 text-pink" aria-hidden />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-fg-subtle">Name</dt>
                      <dd>{agent.name}</dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 size-4 shrink-0 text-pink" aria-hidden />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-fg-subtle">Email</dt>
                      <dd>
                        <a
                          href={`mailto:${agent.email}`}
                          className="text-pink-soft underline underline-offset-4"
                        >
                          {agent.email}
                        </a>
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-pink" aria-hidden />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-fg-subtle">Address</dt>
                      <dd className="whitespace-pre-line">{agent.address}</dd>
                    </div>
                  </div>
                </dl>
              ) : (
                <div className="text-sm text-fg-muted">
                  <p>
                    Notices are accepted through the form on this page
                    {agent.email ? (
                      <>
                        {' '}
                        or by email to{' '}
                        <a
                          href={`mailto:${agent.email}`}
                          className="text-pink-soft underline underline-offset-4"
                        >
                          {agent.email}
                        </a>
                      </>
                    ) : null}
                    .
                  </p>
                  <p className="mt-2 text-xs text-fg-subtle">
                    Full agent details, matching our registration with the U.S. Copyright Office,
                    are published here once the registration is live.
                  </p>
                </div>
              )}
              {agent.registered ? (
                <p className="text-xs text-fg-subtle">
                  These details match our listing in the U.S. Copyright Office DMCA Designated Agent
                  Directory. The form below is the fastest route; email is fine too.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-0 bg-blush">
            <CardContent className="flex flex-col gap-3 text-sm text-fg-muted">
              <h2 className="font-display text-lg font-semibold text-fg">What happens next</h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  We check the notice has every required element. Incomplete notices get a reply
                  asking for the rest.
                </li>
                <li>
                  We disable the track so it cannot be played, and block its content hash from being
                  re-uploaded.
                </li>
                <li>
                  We notify the member who added it and the workspace Owner, and forward your notice
                  to them.
                </li>
                <li>
                  The uploader may send a counter-notice (below). If they do, we forward it to you.
                </li>
                <li>
                  If you do not tell us within 10 business days that you have filed a court action,
                  we restore the track between 10 and 14 business days after receiving the
                  counter-notice.
                </li>
              </ol>
              <p>
                Each valid, un-countered notice is a strike. Three strikes in twelve months and the
                uploader&apos;s account is terminated. See the{' '}
                <Link
                  href="/terms#copyright"
                  className="text-pink-soft underline underline-offset-4"
                >
                  Terms
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 bg-surface-2">
          <CardContent className="relative">
            <div className="mb-6 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink/10 text-pink">
                <ScrollText className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold">Takedown notice</h2>
                <p className="mt-1 text-sm text-fg-muted">
                  Every field maps to an element of 17 U.S.C. § 512(c)(3). All are required.
                </p>
              </div>
            </div>
            <TakedownForm />
          </CardContent>
        </Card>
      </Container>

      <Container className="pb-20 pt-8">
        <div className="rounded-2xl bg-surface-2 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Counter-notices</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted">
            If a track you added was disabled and you believe that was a mistake or a
            misidentification, for example because you own it, you have a licence, or the use is
            otherwise lawful, you can send a counter-notice under 17 U.S.C. § 512(g). Email it to
            the designated agent with the reference from the takedown email. It must include:
          </p>
          <ul className="mt-4 grid gap-3 text-sm text-fg-muted sm:grid-cols-2">
            <li className="rounded-xl bg-surface-2 p-4">
              Your name, address, phone number and email.
            </li>
            <li className="rounded-xl bg-surface-2 p-4">
              Identification of the material that was disabled and the Ume URL where it appeared.
            </li>
            <li className="rounded-xl bg-surface-2 p-4">
              A statement under penalty of perjury that you have a good-faith belief the material
              was disabled as a result of mistake or misidentification.
            </li>
            <li className="rounded-xl bg-surface-2 p-4">
              Consent to the jurisdiction of the federal district court for your address (or, if
              outside the U.S., any district where {BRAND.name} may be found), and that you will
              accept service from the person who sent the notice.
            </li>
            <li className="rounded-xl bg-surface-2 p-4 sm:col-span-2">
              Your physical or electronic signature.
            </li>
          </ul>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-fg-muted">
            We forward counter-notices, including your contact details, to the original claimant. If
            they do not notify us of a court action within 10 business days, we restore the
            material. A counter-notice sent in bad faith can make you liable under § 512(f), so only
            send one if you genuinely have the rights.
          </p>
        </div>
      </Container>
    </>
  )
}
