/**
 * One-off, idempotent backfill: fill users.discord_user_id / discord_username /
 * discord_avatar from existing Discord `accounts` rows. Before the account hooks in
 * apps/web/src/lib/auth.ts these fields were never written (Better Auth drops
 * `input: false` fields returned by mapProfileToUser).
 *
 *   cd packages/db && pnpm exec tsx --env-file=../../.env src/backfill-discord-fields.ts
 *
 * - Only touches users whose discord_user_id is NULL (or whose username is NULL for the
 *   same Discord id), so re-running is safe.
 * - The id comes from accounts.account_id. Username/avatar come from Discord with the
 *   stored access token when it is still valid; otherwise only the id is written.
 * - Skips a Discord id already bound to another user (the column is unique).
 * - Never prints tokens.
 */
import { and, eq, isNull, ne, or } from 'drizzle-orm'
import { closeDb, getDb } from './client'
import { accounts, users } from './schema'

const db = getDb()

const rows = await db
  .select({
    userId: accounts.userId,
    accountId: accounts.accountId,
    accessToken: accounts.accessToken,
    currentDiscordId: users.discordUserId,
  })
  .from(accounts)
  .innerJoin(users, eq(users.id, accounts.userId))
  .where(
    and(
      eq(accounts.providerId, 'discord'),
      or(
        isNull(users.discordUserId),
        and(eq(users.discordUserId, accounts.accountId), isNull(users.discordUsername)),
      ),
    ),
  )

let updated = 0
let withProfile = 0
let skipped = 0

for (const row of rows) {
  if (row.currentDiscordId && row.currentDiscordId !== row.accountId) {
    skipped++
    continue
  }
  const holder = await db.query.users.findFirst({
    where: and(eq(users.discordUserId, row.accountId), ne(users.id, row.userId)),
    columns: { id: true },
  })
  if (holder) {
    console.warn(`skip user ${row.userId}: Discord id already bound to another user`)
    skipped++
    continue
  }

  const profile = row.accessToken ? await fetchProfile(row.accessToken) : null
  try {
    await db
      .update(users)
      .set({
        discordUserId: row.accountId,
        ...(profile ? { discordUsername: profile.username, discordAvatar: profile.avatar } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, row.userId))
    updated++
    if (profile) withProfile++
  } catch (err) {
    console.warn(`skip user ${row.userId}: ${err instanceof Error ? err.message : String(err)}`)
    skipped++
  }
}

console.log(
  `discord backfill: ${rows.length} candidate(s), ${updated} updated (${withProfile} with username/avatar), ${skipped} skipped`,
)
await closeDb()

async function fetchProfile(
  accessToken: string,
): Promise<{ username: string; avatar: string | null } | null> {
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { username?: string; avatar?: string | null }
    return data.username ? { username: data.username, avatar: data.avatar ?? null } : null
  } catch {
    return null
  }
}
