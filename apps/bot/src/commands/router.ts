import {
  ChannelType,
  PermissionFlagsBits,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
  type Interaction,
  type Message,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { ALL_CAPS, CAP, CAP_LABELS, COMMAND_PREFIX, findCommand, hasCap, type CommandSpec } from '@ume/shared'
import { db, getWorkspaceByGuildId, resolveDiscordAccess } from '../lib/db'
import { env } from '../lib/env'
import { errorEmbed } from '../lib/embeds'
import { cachedPlaylistNames } from '../lib/playlists'
import { logger } from '../lib/logger'
import { isGuildAdminOf } from '../lib/guild-inference'
import { buildPrefixContext, buildSlashContext, type CommandContext, type DiscordAccess } from './context'
import { commandMap } from './index'

/** Which slash options get autocomplete (playlist names). */
export const AUTOCOMPLETE_OPTIONS: Record<string, string[]> = { add: ['playlist'], play: ['query'] }

// ------------------------------------------------------------------ permissions

interface Gate {
  ok: boolean
  message?: string
  access: DiscordAccess
  isGuildAdmin: boolean
}

function capLabel(mask: number): string {
  const names = (Object.keys(CAP) as (keyof typeof CAP)[]).filter((k) => hasCap(mask, CAP[k]))
  return names.map((k) => CAP_LABELS[k].label).join(' + ') || 'a workspace'
}

/**
 * Runs BEFORE a command's run(): scope, guild admin, owner and capability checks.
 * Guild owners/Administrators bypass capability checks — it is their server, and
 * they are the ones who set Ume up in the first place.
 */
async function gate(spec: CommandSpec, guild: Guild | null, userId: string): Promise<Gate> {
  if (!guild) {
    if (spec.scope === 'guild') {
      return { ok: false, message: 'Run this inside your server — it needs a server context.', access: null, isGuildAdmin: false }
    }
    return { ok: true, access: null, isGuildAdmin: false }
  }

  const isGuildAdmin = await isGuildAdminOf(guild, userId)
  if (spec.requiresGuildAdmin && !isGuildAdmin) {
    return {
      ok: false,
      message: 'Only the server owner or an Administrator can do that.',
      access: null,
      isGuildAdmin,
    }
  }

  let access: DiscordAccess = null
  try {
    access = await resolveDiscordAccess(db, guild.id, userId)
  } catch (err) {
    logger.error({ err, guildId: guild.id }, 'resolveDiscordAccess failed')
    return { ok: false, message: 'Ume could not reach its database. Try again in a moment.', access: null, isGuildAdmin }
  }

  if (spec.requiresOwner) {
    const isWorkspaceOwner = !!access?.user && !!access.workspace.ownerUserId && access.workspace.ownerUserId === access.user.id
    if (guild.ownerId !== userId && !isWorkspaceOwner) {
      return {
        ok: false,
        message: 'Only the server owner or the workspace Owner on the web can do that.',
        access,
        isGuildAdmin,
      }
    }
    return { ok: true, access, isGuildAdmin }
  }

  if (spec.requires) {
    if (!access) {
      return {
        ok: false,
        message: isGuildAdmin
          ? 'This server has no Ume workspace yet. Run `/reload` to get a token, or claim it at ' +
            `${env.appUrl}/app.`
          : 'This server is not set up with Ume yet. Ask the server owner to run `/reload`.',
        access,
        isGuildAdmin,
      }
    }
    const caps = isGuildAdmin ? ALL_CAPS : access.caps
    if (!hasCap(caps, spec.requires)) {
      const status = access.workspace.status
      const why =
        status !== 'connected'
          ? `This workspace is **${status}**. An admin needs to enter the latest Ume token at ${env.appUrl}/app.`
          : `You need the **${capLabel(spec.requires)}** permission — ask an Admin, or sign in at ${env.appUrl}/app to link your Discord account.`
      return { ok: false, message: why, access, isGuildAdmin }
    }
  }
  return { ok: true, access, isGuildAdmin }
}

// ------------------------------------------------------------------ dispatch

async function execute(ctx: CommandContext): Promise<void> {
  const command = commandMap.get(ctx.spec.name)
  if (!command) return
  try {
    await command.run(ctx)
  } catch (err) {
    logger.error({ err, command: ctx.spec.name, guildId: ctx.guild?.id, userId: ctx.user.id }, 'command failed')
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    await ctx.reply({ embeds: [errorEmbed(message)] }).catch(() => {})
  }
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) return await handleSlash(interaction)
    if (interaction.isAutocomplete()) return await handleAutocomplete(interaction)
    if (interaction.isStringSelectMenu()) return await handleSelect(interaction)
  } catch (err) {
    logger.error({ err, type: interaction.type }, 'interaction handler crashed')
  }
}

async function handleSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  const spec = findCommand(interaction.commandName)
  if (!spec) return
  const args: Record<string, string | undefined> = {}
  for (const opt of spec.options) {
    const raw = interaction.options.get(opt.name)
    const v = raw?.value
    args[opt.name] = v === undefined || v === null ? undefined : String(v)
  }
  const g = await gate(spec, interaction.guild, interaction.user.id)
  const ctx = buildSlashContext(interaction, spec, args, { access: g.access, isGuildAdmin: g.isGuildAdmin })
  if (!g.ok) {
    await ctx.reply({ embeds: [errorEmbed(g.message ?? 'Not allowed.', 'Not allowed')], ephemeral: true })
    return
  }
  await execute(ctx)
}

/** DM server picker: customId `ume:pick:<command>`, value = guild id. */
async function handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const m = interaction.customId.match(/^ume:pick:([a-z]+)$/)
  if (!m) return
  const spec = findCommand(m[1]!)
  if (!spec) return
  const guildId = interaction.values[0]
  const g = await gate(spec, null, interaction.user.id)
  const ctx = buildSlashContext(interaction, spec, { server: guildId }, { access: g.access, isGuildAdmin: g.isGuildAdmin })
  // Remove the picker so it cannot be used twice.
  await interaction.update({ components: [] }).catch(() => {})
  await execute(ctx)
}

async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true)
  const wanted = AUTOCOMPLETE_OPTIONS[interaction.commandName]
  if (!wanted?.includes(focused.name) || !interaction.guildId) return interaction.respond([])
  try {
    const ws = await getWorkspaceByGuildId(db, interaction.guildId)
    if (!ws) return await interaction.respond([])
    const items = await cachedPlaylistNames(interaction.guildId, ws.id)
    const q = String(focused.value ?? '').toLowerCase()
    const choices = items
      .filter((b) => !q || b.name.toLowerCase().includes(q) || b.slug.includes(q))
      .slice(0, 25)
      .map((b) => ({ name: b.name.slice(0, 100), value: b.slug.slice(0, 100) }))
    await interaction.respond(choices)
  } catch (err) {
    logger.warn({ err }, 'autocomplete failed')
    await interaction.respond([]).catch(() => {})
  }
}

// ------------------------------------------------------------------ prefix (~)

/** Tokenizer that respects "double quotes" so `~add "City Pop" <url>` works. */
function tokenize(input: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input))) out.push(m[1] ?? m[2] ?? '')
  return out
}

/**
 * Positional parsing: each option takes one token except the last, which takes
 * the rest of the line (so track titles and server names may contain spaces).
 */
function parseArgs(spec: CommandSpec, rest: string): Record<string, string | undefined> {
  const args: Record<string, string | undefined> = {}
  if (!spec.options.length) return args
  const tokens = tokenize(rest)
  const last = spec.options.length - 1
  spec.options.forEach((opt, i) => {
    if (i < last) {
      args[opt.name] = tokens[i]
    } else {
      const consumed = tokens.slice(0, i)
      // Rebuild the remainder from the raw string so URLs and quotes survive intact.
      let remainder = rest
      for (const t of consumed) {
        const idx = remainder.indexOf(t)
        if (idx >= 0) remainder = remainder.slice(idx + t.length)
      }
      remainder = remainder.replace(/^\s*"?/, '').replace(/"?\s*$/, '').trim()
      args[opt.name] = remainder || undefined
    }
  })
  return args
}

export async function handleMessage(client: Client<true>, message: Message): Promise<void> {
  try {
    if (message.author.bot) return
    const content = message.content ?? ''
    if (!content.startsWith(COMMAND_PREFIX)) return
    const isDm = message.channel.type === ChannelType.DM
    if (!isDm && !env.messageContentIntent) return

    const body = content.slice(COMMAND_PREFIX.length).trim()
    if (!body) return
    const space = body.search(/\s/)
    const name = (space === -1 ? body : body.slice(0, space)).toLowerCase()
    const rest = space === -1 ? '' : body.slice(space + 1).trim()
    const spec = findCommand(name)
    if (!spec) return

    const args = parseArgs(spec, rest)
    // Channel mentions in prefix commands: "<#123>" -> "123".
    for (const opt of spec.options) {
      const v = args[opt.name]
      if (opt.type === 'channel' && v) {
        const mention = v.match(/^<#(\d+)>$/)
        if (mention) args[opt.name] = mention[1]
        else if (message.guild) {
          const byName = message.guild.channels.cache.find(
            (c) => c.name.toLowerCase() === v.replace(/^#/, '').toLowerCase() && c.isVoiceBased(),
          )
          if (byName) args[opt.name] = byName.id
        }
      }
      if (opt.type === 'user' && v) {
        const mention = v.match(/^<@!?(\d+)>$/)
        if (mention) args[opt.name] = mention[1]
      }
    }

    const g = await gate(spec, message.guild, message.author.id)
    const ctx = buildPrefixContext(message, spec, args, { access: g.access, isGuildAdmin: g.isGuildAdmin })
    if (!g.ok) {
      await ctx.reply({ embeds: [errorEmbed(g.message ?? 'Not allowed.', 'Not allowed')] })
      return
    }
    // Guild prefix commands must respect channel send permission.
    if (message.guild && 'permissionsFor' in message.channel) {
      const me = message.guild.members.me
      const perms = me ? message.channel.permissionsFor(me) : null
      if (perms && !perms.has(PermissionFlagsBits.SendMessages)) return
    }
    await execute(ctx)
  } catch (err) {
    logger.error({ err }, 'message handler crashed')
  }
}
