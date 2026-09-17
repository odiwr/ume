import 'server-only'
import { and, eq, ne } from 'drizzle-orm'
import { users } from '@ume/db'
import { db } from './db'

const DISCORD_ME = 'https://discord.com/api/v10/users/@me'

/**
 * Copies the verified Discord identity from a Discord `accounts` row onto `users`.
 *
 * Why this exists: Better Auth drops `input: false` additional fields from a provider
 * profile (parseAdditionalUserInputFromProviderProfile skips them), so `mapProfileToUser`
 * can never set discordUserId. Called from the account create/update database hooks in
 * auth.ts, i.e. on first Discord sign-in, on linking Discord to an existing user, and on
 * every later Discord sign-in or token refresh.
 *
 * - The id comes from the account row (`accountId`), which Better Auth took from Discord.
 * - Username and avatar come from Discord with the account's access token; if that call
 *   fails the id is still written and the previous username/avatar are kept.
 * - A Discord id already bound to a different user is never copied onto a second user
 *   (users.discord_user_id is unique); the sync is skipped instead.
 * Never throws: a failed sync must not break sign-in. Never logs tokens.
 */
export async function syncDiscordIdentity(account: {
  userId?: string | null
  accountId?: string | null
  providerId?: string | null
  accessToken?: string | null
}): Promise<void> {
  if (account.providerId !== 'discord' || !account.userId || !account.accountId) return
  const userId = account.userId
  const discordUserId = account.accountId
  try {
    const holder = await db.query.users.findFirst({
      where: and(eq(users.discordUserId, discordUserId), ne(users.id, userId)),
      columns: { id: true },
    })
    if (holder) {
      console.warn('[auth] Discord identity already bound to another user; not copied', {
        userId,
      })
      return
    }

    const profile = account.accessToken ? await fetchDiscordProfile(account.accessToken) : null
    await db
      .update(users)
      .set({
        discordUserId,
        ...(profile
          ? { discordUsername: profile.username, discordAvatar: profile.avatar ?? null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
  } catch (err) {
    // Most likely a unique violation from a concurrent link; leave the user untouched.
    console.error('[auth] Could not sync Discord identity', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function fetchDiscordProfile(
  accessToken: string,
): Promise<{ id: string; username: string; avatar: string | null } | null> {
  try {
    const res = await fetch(DISCORD_ME, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id: string; username: string; avatar: string | null }
    return data?.username ? data : null
  } catch {
    return null
  }
}
