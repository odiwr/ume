import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Read locally, report variable NAMES only. Never print secret values.
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

const groups = {
  'Web origins': ['APP_URL', 'NEXT_PUBLIC_APP_URL', 'BETTER_AUTH_URL'],
  Database: ['DATABASE_URL', 'DATABASE_URL_DIRECT'],
  Authentication: [
    'BETTER_AUTH_SECRET',
    'DISCORD_CLIENT_ID',
    'NEXT_PUBLIC_DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_BOT_TOKEN',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'CEO_EMAILS',
  ],
  Storage: ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
  Billing: [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_PLUS',
    'STRIPE_PRICE_PRO',
    'STRIPE_PRICE_STUDIO',
    'STRIPE_PRICE_PLUS_YEARLY',
    'STRIPE_PRICE_PRO_YEARLY',
    'STRIPE_PRICE_STUDIO_YEARLY',
  ],
  Email: ['RESEND_API_KEY', 'EMAIL_FROM'],
  'Published contact': ['DMCA_AGENT_NAME', 'DMCA_AGENT_EMAIL', 'DMCA_AGENT_ADDRESS'],
}
let problems = 0
for (const [label, keys] of Object.entries(groups)) {
  const unset = keys.filter((key) => !process.env[key]?.trim())
  const placeholder = keys.filter((key) => {
    const value = process.env[key] ?? ''
    return (
      value &&
      /localhost|127\.0\.0\.1|change[-_ ]?me|your[-_]|example\.(com|org)|replace[-_ ]?me|^<.+>$|REPLACE_WITH/i.test(
        value,
      )
    )
  })
  console.log(
    `${label}: ${unset.length || placeholder.length ? 'needs configuration' : 'values present (not remotely verified)'}`,
  )
  if (unset.length) console.log(`  Missing: ${unset.join(', ')}`)
  if (placeholder.length) console.log(`  Placeholder: ${placeholder.join(', ')}`)
  problems += unset.length + placeholder.length
}
const origins = groups['Web origins'].map((key) => process.env[key]).filter(Boolean)
if (
  origins.length === 3 &&
  (new Set(origins.map((v) => v.replace(/\/$/, ''))).size !== 1 ||
    origins.some((v) => !v.startsWith('https://')))
) {
  console.log('Web origins must match and use HTTPS for production.')
  problems++
}
if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32) {
  console.log('BETTER_AUTH_SECRET must contain at least 32 characters.')
  problems++
}
if (process.env.DISCORD_CLIENT_ID !== process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID) {
  console.log('Discord server and public client IDs must match.')
  problems++
}
console.log(
  '\nThis checks configuration presence only. OAuth callbacks, DNS, database migrations, storage access, billing, email delivery, and bot/worker health still need live verification.',
)
process.exitCode = problems ? 1 : 0
