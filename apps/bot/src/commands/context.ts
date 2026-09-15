import type {
  ActionRowBuilder,
  ButtonBuilder,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextBasedChannel,
  User,
} from 'discord.js'
import { MessageFlags } from 'discord.js'
import type { CommandSpec } from '@ume/shared'
import type { Access, User as DbUser } from '@ume/db'

export type ReplyPayload =
  | string
  | {
      content?: string
      embeds?: EmbedBuilder[]
      components?: ActionRowBuilder<MessageActionRowComponentBuilder | StringSelectMenuBuilder | ButtonBuilder>[]
      /** Slash only; ignored for prefix (DM/channel) replies. Defaults per command. */
      ephemeral?: boolean
    }

export type DiscordAccess = (Access & { user: DbUser | null }) | null

/**
 * One abstraction over slash interactions and `~` messages so every command is
 * written once. The router fills `access` (workspace + caps) for guild commands.
 */
export interface CommandContext {
  source: 'slash' | 'prefix'
  client: Client<true>
  spec: CommandSpec
  user: User
  guild: Guild | null
  member: GuildMember | null
  channel: TextBasedChannel | null
  channelId: string
  /** Option name -> raw string value (ids for channel/user options). */
  args: Record<string, string | undefined>
  /** Resolved by the router for guild commands; null in DMs or when no workspace exists. */
  access: DiscordAccess
  /** True when the invoker is the guild owner or has Administrator. */
  isGuildAdmin: boolean
  interaction?: ChatInputCommandInteraction | StringSelectMenuInteraction
  message?: Message
  reply(payload: ReplyPayload): Promise<void>
  followUp(payload: ReplyPayload): Promise<void>
  defer(): Promise<void>
}

export interface Command {
  spec: CommandSpec
  run(ctx: CommandContext): Promise<void>
}

/** Admin/setup commands default to ephemeral so tokens and codes never sit in a channel. */
export function defaultEphemeral(spec: CommandSpec): boolean {
  return spec.category === 'setup' || spec.category === 'info' || !!spec.requiresGuildAdmin || !!spec.requiresOwner
}

function normalize(payload: ReplyPayload) {
  return typeof payload === 'string' ? { content: payload } : payload
}

export function buildSlashContext(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  spec: CommandSpec,
  args: Record<string, string | undefined>,
  extras: { access: DiscordAccess; isGuildAdmin: boolean },
): CommandContext {
  let deferred = false
  const ephemeralDefault = defaultEphemeral(spec)
  const member = interaction.inCachedGuild() ? interaction.member : null
  return {
    source: 'slash',
    client: interaction.client,
    spec,
    user: interaction.user,
    guild: interaction.guild,
    member,
    channel: interaction.channel,
    channelId: interaction.channelId,
    args,
    access: extras.access,
    isGuildAdmin: extras.isGuildAdmin,
    interaction,
    async defer() {
      if (deferred || interaction.replied) return
      deferred = true
      await interaction.deferReply({ flags: ephemeralDefault ? MessageFlags.Ephemeral : undefined })
    },
    async reply(payload) {
      const p = normalize(payload)
      const ephemeral = p.ephemeral ?? ephemeralDefault
      const body = { content: p.content, embeds: p.embeds, components: p.components as never }
      if (deferred || interaction.deferred) {
        await interaction.editReply(body)
      } else if (interaction.replied) {
        await interaction.followUp({ ...body, flags: ephemeral ? MessageFlags.Ephemeral : undefined })
      } else {
        await interaction.reply({ ...body, flags: ephemeral ? MessageFlags.Ephemeral : undefined })
      }
    },
    async followUp(payload) {
      const p = normalize(payload)
      const ephemeral = p.ephemeral ?? ephemeralDefault
      await interaction.followUp({
        content: p.content,
        embeds: p.embeds,
        components: p.components as never,
        flags: ephemeral ? MessageFlags.Ephemeral : undefined,
      })
    },
  }
}

export function buildPrefixContext(
  message: Message,
  spec: CommandSpec,
  args: Record<string, string | undefined>,
  extras: { access: DiscordAccess; isGuildAdmin: boolean },
): CommandContext {
  const send = async (payload: ReplyPayload) => {
    const p = normalize(payload)
    const body = { content: p.content, embeds: p.embeds, components: p.components as never }
    if (message.channel.isSendable()) await message.channel.send(body)
  }
  return {
    source: 'prefix',
    client: message.client,
    spec,
    user: message.author,
    guild: message.guild,
    member: message.member,
    channel: message.channel,
    channelId: message.channelId,
    args,
    access: extras.access,
    isGuildAdmin: extras.isGuildAdmin,
    message,
    async defer() {
      if (message.channel.isSendable() && 'sendTyping' in message.channel) await message.channel.sendTyping().catch(() => {})
    },
    reply: send,
    followUp: send,
  }
}
