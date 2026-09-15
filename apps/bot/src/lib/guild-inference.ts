import { eq } from 'drizzle-orm'
import { ActionRowBuilder, PermissionFlagsBits, StringSelectMenuBuilder, type Client, type Guild } from 'discord.js'
import { db, users, workspaces } from './db'

export type GuildInference =
  | { kind: 'one'; guild: Guild }
  | { kind: 'many'; guilds: Guild[] }
  | { kind: 'none' }

const SHARED_GUILD_SCAN_LIMIT = 25

/** Guild owner or Administrator: the only people who may claim/rotate/reset/purge. */
export async function isGuildAdminOf(guild: Guild, userId: string): Promise<boolean> {
  if (guild.ownerId === userId) return true
  const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null))
  return !!member && member.permissions.has(PermissionFlagsBits.Administrator)
}

/**
 * Which server did a DM command mean? Candidates are every server the user owns,
 * up to 25 shared servers where they hold Administrator, and servers whose Ume
 * workspace they own on the web. A server name (or id) narrows the list.
 */
export async function inferGuild(client: Client<true>, userId: string, serverArg?: string): Promise<GuildInference> {
  const candidates = new Map<string, Guild>()
  for (const g of client.guilds.cache.values()) if (g.ownerId === userId) candidates.set(g.id, g)

  let scanned = 0
  for (const g of client.guilds.cache.values()) {
    if (candidates.has(g.id)) continue
    if (scanned >= SHARED_GUILD_SCAN_LIMIT) break
    scanned++
    const member = g.members.cache.get(userId) ?? (await g.members.fetch(userId).catch(() => null))
    if (member?.permissions.has(PermissionFlagsBits.Administrator)) candidates.set(g.id, g)
  }

  // Web workspace owners (linked Discord account) may also manage their server from a DM.
  const linked = await db.query.users.findFirst({ where: eq(users.discordUserId, userId), columns: { id: true } })
  if (linked) {
    const owned = await db.query.workspaces.findMany({
      where: eq(workspaces.ownerUserId, linked.id),
      columns: { guildId: true },
    })
    for (const w of owned) {
      const g = client.guilds.cache.get(w.guildId)
      if (g) candidates.set(g.id, g)
    }
  }

  let list = [...candidates.values()]
  const arg = serverArg?.trim()
  if (arg && list.length) {
    const byId = list.find((g) => g.id === arg)
    if (byId) return { kind: 'one', guild: byId }
    const lower = arg.toLowerCase()
    const exact = list.filter((g) => g.name.toLowerCase() === lower)
    const starts = exact.length ? exact : list.filter((g) => g.name.toLowerCase().startsWith(lower))
    list = starts
  }
  if (list.length === 1) return { kind: 'one', guild: list[0]! }
  if (list.length > 1) return { kind: 'many', guilds: list.slice(0, 25) }
  return { kind: 'none' }
}

/** customId format: ume:pick:<command> — the selected value is the guild id. */
export function guildPickerRow(command: string, guilds: Guild[]) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`ume:pick:${command}`)
    .setPlaceholder('Pick a server')
    .addOptions(
      guilds.slice(0, 25).map((g) => ({
        label: g.name.slice(0, 100),
        value: g.id,
        description: `${g.memberCount} members`.slice(0, 100),
      })),
    )
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)
}

export const NO_GUILD_MESSAGE =
  'I could not work out which server you mean. Run this command inside your server, or make sure Ume is in it and you are its owner or an Administrator.'
