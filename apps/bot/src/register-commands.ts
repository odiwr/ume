import { REST, Routes } from '@discordjs/rest'
import {
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type RESTPutAPIApplicationCommandsJSONBody,
} from 'discord.js'
import { COMMANDS, type CommandSpec } from '@ume/shared'

/** Options that offer playlist-name autocomplete (must match router.AUTOCOMPLETE_OPTIONS). */
const AUTOCOMPLETE: Record<string, string[]> = { add: ['playlist'], play: ['query'] }

function contextsFor(spec: CommandSpec): InteractionContextType[] {
  // 'dm' commands (reload/reset/purge/confirm) must work in a server too — that is
  // where the guild is known — so they get both contexts.
  if (spec.scope === 'guild') return [InteractionContextType.Guild]
  return [InteractionContextType.Guild, InteractionContextType.BotDM]
}

export function buildCommand(spec: CommandSpec): SlashCommandBuilder {
  const b = new SlashCommandBuilder().setName(spec.name).setDescription(spec.description.slice(0, 100))
  b.setContexts(contextsFor(spec))
  if (spec.requiresGuildAdmin || spec.requiresOwner) b.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  for (const opt of spec.options) {
    const desc = opt.description.slice(0, 100)
    switch (opt.type) {
      case 'string':
        b.addStringOption((o) =>
          o
            .setName(opt.name)
            .setDescription(desc)
            .setRequired(opt.required)
            .setAutocomplete(!!AUTOCOMPLETE[spec.name]?.includes(opt.name)),
        )
        break
      case 'integer':
        b.addIntegerOption((o) => o.setName(opt.name).setDescription(desc).setRequired(opt.required))
        break
      case 'channel':
        b.addChannelOption((o) =>
          o.setName(opt.name).setDescription(desc).setRequired(opt.required).addChannelTypes(ChannelType.GuildVoice),
        )
        break
      case 'user':
        b.addUserOption((o) => o.setName(opt.name).setDescription(desc).setRequired(opt.required))
        break
    }
  }
  return b
}

export function buildAllCommands(): RESTPutAPIApplicationCommandsJSONBody {
  return COMMANDS.map((c) => buildCommand(c).toJSON())
}

/**
 * PUT replaces the full command set, so this is idempotent: run it as often as you
 * like. With DISCORD_DEV_GUILD_ID set, commands land in that guild instantly
 * (global commands take up to an hour to propagate).
 */
export async function registerCommands(): Promise<number> {
  const token = process.env.DISCORD_BOT_TOKEN
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!token || !clientId) throw new Error('DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set')
  const devGuildId = process.env.DISCORD_DEV_GUILD_ID || undefined
  const rest = new REST({ version: '10' }).setToken(token)
  const body = buildAllCommands()
  const route = devGuildId ? Routes.applicationGuildCommands(clientId, devGuildId) : Routes.applicationCommands(clientId)
  const result = (await rest.put(route, { body })) as unknown[]
  return result.length
}

const isMain = process.argv[1] && /register-commands\.(ts|js|mjs)$/.test(process.argv[1])
if (isMain) {
  registerCommands()
    .then((n) => {
      const scope = process.env.DISCORD_DEV_GUILD_ID ? `guild ${process.env.DISCORD_DEV_GUILD_ID}` : 'global'
      console.log(`Registered ${n} slash commands (${scope}).`)
      process.exit(0)
    })
    .catch((err) => {
      console.error('Failed to register commands:', err)
      process.exit(1)
    })
}
