import 'server-only'
import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { accounts, sessions, users, verifications } from '@ume/db'
import { db } from './db'
import { syncDiscordIdentity } from './discord-identity'

/**
 * Better Auth. Two social providers:
 *  - Discord: the primary identity for everyone who manages music. `identify` gives us a
 *    verified Discord user id (this replaces "type your Discord ID"); `guilds` lets the
 *    web app check owner/Administrator on a server for OAuth-based claiming and for
 *    invite links that require server membership.
 *  - Google: the only way into the CEO console (see requireCeo), and an optional sign-in.
 */
export const auth = betterAuth({
  appName: 'Ume',
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
    schema: { users, sessions, accounts, verifications },
  }),
  user: {
    additionalFields: {
      discordUserId: { type: 'string', required: false, input: false },
      discordUsername: { type: 'string', required: false, input: false },
      discordAvatar: { type: 'string', required: false, input: false },
      banned: { type: 'boolean', required: false, input: false, defaultValue: false },
      banReason: { type: 'string', required: false, input: false },
    },
  },
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
      scope: ['identify', 'email', 'guilds'],
      // No mapProfileToUser for the discord* fields: Better Auth discards `input: false`
      // fields from a provider profile. They are written by databaseHooks below.
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'discord'],
    },
  },
  // Discord identity on users (discordUserId/Username/Avatar). Account rows are created when
  // Discord signs up or is linked, and updated on each Discord sign-in and token refresh.
  // After-hooks run once the auth transaction commits. See lib/discord-identity.ts.
  databaseHooks: {
    account: {
      create: { after: (account) => syncDiscordIdentity(account) },
      update: { after: (account) => (account ? syncDiscordIdentity(account) : Promise.resolve()) },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    // Generate UUIDs in the app. The string 'uuid' makes Better Auth leave ids to Postgres,
    // but the auth tables use text ids with no column default, so every insert failed.
    database: { generateId: () => crypto.randomUUID() },
  },
  plugins: [nextCookies()], // must be last
})

export type AuthSession = typeof auth.$Infer.Session
