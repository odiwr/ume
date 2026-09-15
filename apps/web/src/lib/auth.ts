import 'server-only'
import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { accounts, sessions, users, verifications } from '@ume/db'
import { db } from './db'

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
      mapProfileToUser: (profile) => ({
        discordUserId: profile.id,
        discordUsername: profile.username,
        discordAvatar: profile.avatar ?? null,
      }),
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
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    database: { generateId: 'uuid' },
  },
  plugins: [nextCookies()], // must be last
})

export type AuthSession = typeof auth.$Infer.Session
