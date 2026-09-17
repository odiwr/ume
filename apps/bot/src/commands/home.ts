import { eq } from '../lib/orm'
import { ChannelType } from 'discord.js'
import { findCommand } from '@ume/shared'
import { db, logAudit, touchActivity, workspaces } from '../lib/db'
import { errorEmbed, successEmbed } from '../lib/embeds'
import { voice } from '../voice'
import {
  VoicePermissionError,
  auditSelfGrant,
  ensureVoicePermissions,
  resolveMe,
  voicePermissionEmbed,
} from '../voice/permissions'
import type { Command } from './context'
import { requireWorkspace } from './setup-shared'

export const home: Command = {
  spec: findCommand('home')!,
  async run(ctx) {
    const guild = ctx.guild!
    await ctx.defer()
    const ws = await requireWorkspace(ctx, guild)
    if (!ws) return

    const channelId = ctx.args.channel ?? ctx.member?.voice.channelId ?? null
    if (!channelId) {
      await ctx.reply({
        embeds: [
          errorEmbed('Join a voice channel first, or pass one: `/home #lounge`.', 'Which channel?'),
        ],
      })
      return
    }
    const channel =
      guild.channels.cache.get(channelId) ??
      (await guild.channels.fetch(channelId).catch(() => null))
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await ctx.reply({
        embeds: [
          errorEmbed(
            'That is not a voice channel. Ume lives in regular voice channels (not stages).',
            'Not a voice channel',
          ),
        ],
      })
      return
    }
    const clientId = ctx.client.application?.id ?? ctx.client.user.id
    // Ume allows itself View/Connect/Speak/Set Voice Channel Status here when it has Manage Roles.
    const me = await resolveMe(guild)
    const perms = me ? await ensureVoicePermissions(channel, me) : null
    if (me && perms && !perms.ok) {
      const canManageRoles = channel.permissionsFor(me).has('ManageRoles')
      const err = new VoicePermissionError(guild.id, channel.id, perms.missing, canManageRoles)
      await ctx.reply({ embeds: [voicePermissionEmbed(err, clientId)] })
      return
    }

    const noticeChannelId =
      ws.noticeTextChannelId ??
      (ctx.channel && 'guildId' in ctx.channel && ctx.channel.type === ChannelType.GuildText
        ? ctx.channel.id
        : null)
    await db
      .update(workspaces)
      .set({
        homeVoiceChannelId: channel.id,
        noticeTextChannelId: noticeChannelId,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, ws.id))
    await logAudit(db, {
      workspaceId: ws.id,
      actorDiscordId: ctx.user.id,
      actorUserId: ctx.access?.user?.id ?? null,
      action: 'home.set',
      targetType: 'channel',
      targetId: channel.id,
      metadata: { from: ws.homeVoiceChannelId, to: channel.id },
    })
    if (perms?.granted.length) {
      await auditSelfGrant(ws.id, channel.id, perms.granted, ctx.user.id)
    }
    await touchActivity(db, ws.id, {
      kind: 'command',
      discordUserId: ctx.user.id,
      metadata: { command: 'home' },
    })

    try {
      await voice().join(guild, channel.id, ws.id)
    } catch (err) {
      await ctx.reply({
        embeds: [
          err instanceof VoicePermissionError
            ? voicePermissionEmbed(err, clientId)
            : errorEmbed(
                `Saved <#${channel.id}> as home, but joining failed: ${(err as Error).message}`,
                'Could not join',
              ),
        ],
      })
      return
    }
    const notes: string[] = []
    if (perms?.granted.length) {
      notes.push(
        `I allowed myself **${perms.granted.join(', ')}** in <#${channel.id}> (a member permission for Ume only).`,
      )
    }
    if (perms?.missingOptional.length) {
      notes.push(
        'Without **Set Voice Channel Status** there, the channel status will not show what is playing.',
      )
    }
    await ctx.reply({
      embeds: [
        successEmbed(
          [
            `<#${channel.id}> is my home now. I will stay here 24/7, pause when the room is empty, and follow if you drag me somewhere else.`,
            ...notes,
          ].join('\n\n'),
          'Home set',
        ),
      ],
      ephemeral: false,
    })
  },
}
