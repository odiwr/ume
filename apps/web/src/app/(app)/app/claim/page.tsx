import type { Metadata } from 'next'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { isClaimTokenShape } from '@ume/shared'
import { Card, CardContent } from '@/components/ui/card'
import { ClaimTokenForm } from '@/components/app/claim-token-form'
import { PageHeader } from '@/components/app/page-header'
import { TopBar } from '@/components/app/top-bar'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Enter a token', robots: { index: false } }

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const session = await requireUser('/app/claim')
  const params = await searchParams
  const raw = Array.isArray(params.token) ? params.token[0] : params.token
  // Only prefill something that looks like a token; never echo arbitrary input back.
  const initialToken = raw && isClaimTokenShape(raw) ? raw.trim().toLowerCase() : ''

  return (
    <div className="min-h-dvh">
      <TopBar user={session.user} crumbs={[{ href: '/app', label: 'Your servers' }, { label: 'Enter a token' }]} />
      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Enter an Ume token"
          description="The token Ume sent you in Discord claims a new server or reconnects one after a /reload. It works exactly once."
        />
        <Card>
          <CardContent className="space-y-6">
            <ClaimTokenForm initialToken={initialToken} />
          </CardContent>
        </Card>
        <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-fg-muted [text-wrap:pretty]">
          <Info className="mt-0.5 size-3.5 shrink-0 text-pink" aria-hidden />
          <p>
            Own or administer the server on Discord? You can skip the token and{' '}
            <Link href="/app/new" className="text-fg underline underline-offset-4">
              claim it from the server picker
            </Link>
            . Tokens are stored hashed and never shown again.
          </p>
        </div>
      </main>
    </div>
  )
}
