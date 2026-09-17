import {
  OverwriteType,
  PermissionFlagsBits,
  type EmbedBuilder,
  type Guild,
  type GuildMember,
  type PermissionOverwriteOptions,
  type VoiceBasedChannel,
} from 'discord.js'
import { botInviteUrl } from '@ume/shared'
import { db, logAudit } from '../lib/db'
import { errorEmbed } from '../lib/embeds'
import { logger } from '../lib/logger'

type PermName = 'ViewChannel' | 'Connect' | 'Speak' | 'SetVoiceChannelStatus'

/** Without these Ume cannot play at all. */
const REQUIRED: PermName[] = ['ViewChannel', 'Connect', 'Speak']
/** Nice to have: the "▶ Title — Artist" voice channel status line. */
const OPTIONAL: PermName[] = ['SetVoiceChannelStatus']

const LABEL: Record<PermName, string> = {
  ViewChannel: 'View Channel',
  Connect: 'Connect',
  Speak: 'Speak',
  SetVoiceChannelStatus: 'Set Voice Channel Status',
}

export const SELF_GRANT_REASON = 'Ume: allow itself to play in its home channel'

/** Do not hammer Discord with an overwrite edit that was just refused. */
const REFUSAL_COOLDOWN_MS = 10 * 60 * 1000
const refusedAt = new Map<string, number>()

export interface VoicePermissionResult {
  ok: boolean
  /** Required permissions still missing (empty when ok). */
  missing: string[]
  /** Optional permissions still missing (status line). */
  missingOptional: string[]
  /** Permissions Ume just allowed itself through a member overwrite. */
  granted: string[]
}

/** Thrown by `VoiceManager.join` when Ume cannot play in the channel and could not fix it. */
export class VoicePermissionError extends Error {
  readonly guildId: string
  readonly channelId: string
  readonly missing: string[]
  readonly canManageRoles: boolean

  constructor(guildId: string, channelId: string, missing: string[], canManageRoles: boolean) {
    super(`Ume is missing ${joinList(missing)} in that channel and could not allow itself`)
    this.name = 'VoicePermissionError'
    this.guildId = guildId
    this.channelId = channelId
    this.missing = missing
    this.canManageRoles = canManageRoles
  }
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function missingIn(channel: VoiceBasedChannel, me: GuildMember, names: PermName[]): PermName[] {
  const perms = channel.permissionsFor(me)
  return names.filter((n) => !perms.has(PermissionFlagsBits[n]))
}

export async function resolveMe(guild: Guild): Promise<GuildMember | null> {
  return guild.members.me ?? (await guild.members.fetchMe().catch(() => null))
}

/**
 * Make sure Ume can View, Connect and Speak (and ideally Set Voice Channel Status) in a voice
 * channel. When something is missing and Ume has Manage Roles there, it merges a member
 * overwrite for itself that only ALLOWS the missing permissions it already holds at server
 * level. It never denies anything and never touches role or other members' overwrites.
 */
export async function ensureVoicePermissions(
  channel: VoiceBasedChannel,
  me: GuildMember,
): Promise<VoicePermissionResult> {
  const wanted = [...REQUIRED, ...OPTIONAL]
  let missing = missingIn(channel, me, wanted)
  const granted: string[] = []
  const result = (): VoicePermissionResult => {
    const req = missing.filter((n) => REQUIRED.includes(n))
    return {
      ok: req.length === 0,
      missing: req.map((n) => LABEL[n]),
      missingOptional: missing.filter((n) => OPTIONAL.includes(n)).map((n) => LABEL[n]),
      granted,
    }
  }
  if (!missing.length) return result()

  // Discord only lets a bot allow permissions it holds at server level.
  const grantable = missing.filter((n) => me.permissions.has(PermissionFlagsBits[n]))
  const canManageRoles = channel.permissionsFor(me).has(PermissionFlagsBits.ManageRoles)
  const key = `${channel.id}:${grantable.join(',')}`
  const lastRefusal = refusedAt.get(key)
  const coolingDown = lastRefusal !== undefined && Date.now() - lastRefusal < REFUSAL_COOLDOWN_MS
  if (!grantable.length || !canManageRoles || coolingDown) return result()

  const allow: PermissionOverwriteOptions = {}
  for (const n of grantable) allow[n] = true
  try {
    await channel.permissionOverwrites.edit(me.id, allow, {
      reason: SELF_GRANT_REASON,
      type: OverwriteType.Member,
    })
    granted.push(...grantable.map((n) => LABEL[n]))
    refusedAt.delete(key)
    logger.info(
      { guildId: channel.guildId, channelId: channel.id, granted },
      'granted itself voice permissions in home channel',
    )
  } catch (err) {
    refusedAt.set(key, Date.now())
    logger.warn(
      {
        guildId: channel.guildId,
        channelId: channel.id,
        wanted: grantable,
        code: (err as { code?: unknown }).code,
        message: (err as Error).message,
      },
      'could not grant itself voice permissions',
    )
    return result()
  }

  // The overwrite edit does not patch the cache; re-fetch so permissionsFor sees it.
  const fresh = await channel.guild.channels.fetch(channel.id, { force: true }).catch(() => null)
  const target = fresh?.isVoiceBased() ? fresh : channel
  missing = missingIn(target, me, wanted)
  return result()
}

/** Throws {@link VoicePermissionError} when Ume still cannot play in the channel. */
export async function assertVoicePermissions(
  channel: VoiceBasedChannel,
): Promise<VoicePermissionResult | null> {
  const me = await resolveMe(channel.guild)
  if (!me) return null // cannot evaluate; let the voice connection try
  const res = await ensureVoicePermissions(channel, me)
  if (res.ok) return res
  throw new VoicePermissionError(
    channel.guildId,
    channel.id,
    res.missing,
    channel.permissionsFor(me).has(PermissionFlagsBits.ManageRoles),
  )
}

/** Audit trail for a self-grant (best effort; never blocks joining). */
export async function auditSelfGrant(
  workspaceId: string,
  channelId: string,
  granted: string[],
  actorDiscordId?: string,
): Promise<void> {
  if (!granted.length) return
  await logAudit(db, {
    workspaceId,
    actorDiscordId: actorDiscordId ?? null,
    action: 'bot.voice_permissions_granted',
    targetType: 'channel',
    targetId: channelId,
    metadata: { granted, reason: SELF_GRANT_REASON },
  }).catch((err) => logger.warn({ err, workspaceId }, 'failed to audit voice self-grant'))
}

/** Actionable copy for server admins, in the standard error card. */
export function voicePermissionEmbed(err: VoicePermissionError, clientId: string): EmbedBuilder {
  const invite = botInviteUrl(clientId, err.guildId)
  const cause = err.canManageRoles
    ? 'I tried to allow myself there, but Discord refused (usually because I cannot see the channel).'
    : 'I could not allow myself there because I do not have **Manage Roles** in that channel.'
  return errorEmbed(
    [
      `I cannot play in <#${err.channelId}>: I am missing **${joinList(err.missing)}** there. ${cause}`,
      '',
      'A server admin can fix it either way:',
      `**1.** [Re-invite Ume with the updated link](${invite}). It keeps your settings and adds Manage Roles, so I can allow myself in my home channel.`,
      `**2.** Open <#${err.channelId}> → **Edit Channel** → **Permissions**, add **Ume** as a member and allow **View Channel**, **Connect** and **Speak** (and **Set Voice Channel Status** for the now-playing line).`,
      '',
      'Then run `/home` again.',
    ].join('\n'),
    'Missing voice permissions',
  )
}
