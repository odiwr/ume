import { eq } from '../lib/orm'
import type { Guild } from 'discord.js'
import { db, getWorkspaceByGuildId, users, type Workspace } from '../lib/db'
import { NO_GUILD_MESSAGE, guildPickerRow, inferGuild, isGuildAdminOf } from '../lib/guild-inference'
import { errorEmbed, umeEmbed } from '../lib/embeds'
import type { CommandContext } from './context'

/**
 * reload / reset / purge work in a server (guild known) and in DMs (guild inferred).
 * Returns the guild to act on, or null after having replied with a picker / error.
 * In DMs the router cannot check permissions, so this re-checks them for the
 * chosen guild and always re-reads guild.ownerId at issuance time.
 */
export async function resolveTargetGuild(ctx: CommandContext, mode: 'admin' | 'owner'): Promise<Guild | null> {
  let guild = ctx.guild
  if (!guild) {
    const inferred = await inferGuild(ctx.client, ctx.user.id, ctx.args.server)
    if (inferred.kind === 'none') {
      await ctx.reply({ embeds: [errorEmbed(NO_GUILD_MESSAGE, 'Which server?')] })
      return null
    }
    if (inferred.kind === 'many') {
      await ctx.reply({
        embeds: [
          umeEmbed({
            title: 'Which server?',
            description: `You manage ${inferred.guilds.length} servers with Ume. Pick one, or run \`~${ctx.spec.name} <server name>\`.`,
            thumbnail: null,
          }),
        ],
        components: [guildPickerRow(ctx.spec.name, inferred.guilds)],
      })
      return null
    }
    guild = inferred.guild
  }

  // Fresh permission check against the live guild (owner id can change).
  const fresh = await guild.fetch().catch(() => guild!)
  const isAdmin = await isGuildAdminOf(fresh, ctx.user.id)
  if (mode === 'admin' && !isAdmin) {
    await ctx.reply({ embeds: [errorEmbed(`Only the owner or an Administrator of **${fresh.name}** can do that.`, 'Not allowed')] })
    return null
  }
  if (mode === 'owner') {
    const ws = await getWorkspaceByGuildId(db, fresh.id)
    const linked = await db.query.users.findFirst({ where: eq(users.discordUserId, ctx.user.id), columns: { id: true } })
    const isWorkspaceOwner = !!ws?.ownerUserId && !!linked && ws.ownerUserId === linked.id
    if (fresh.ownerId !== ctx.user.id && !isWorkspaceOwner) {
      await ctx.reply({
        embeds: [errorEmbed(`Only the owner of **${fresh.name}** (or its workspace Owner on the web) can do that.`, 'Not allowed')],
      })
      return null
    }
  }
  return fresh
}

/** Workspace for a guild, or reply with setup instructions and return null. */
export async function requireWorkspace(ctx: CommandContext, guild: Guild): Promise<Workspace | null> {
  const ws = await getWorkspaceByGuildId(db, guild.id)
  if (!ws) {
    await ctx.reply({
      embeds: [
        errorEmbed(
          `**${guild.name}** has no Ume workspace yet. Run \`/reload\` to get a token, or sign in on the web and pick the server.`,
          'Not set up yet',
        ),
      ],
    })
    return null
  }
  if (ws.status === 'purged' || ws.status === 'purging') {
    await ctx.reply({ embeds: [errorEmbed('This workspace is being deleted. Run `/reload` once the purge finishes to start over.', 'Purged')] })
    return null
  }
  return ws
}

/** Linked web user id for a Discord user, if they have signed in with Discord. */
export async function linkedUserId(discordUserId: string): Promise<string | null> {
  const u = await db.query.users.findFirst({ where: eq(users.discordUserId, discordUserId), columns: { id: true } })
  return u?.id ?? null
}
