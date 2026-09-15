import { eq } from 'drizzle-orm'
import { ChannelType, PermissionFlagsBits } from 'discord.js'
import { findCommand } from '@ume/shared'
import { db, logAudit, touchActivity, workspaces } from '../lib/db'
import { errorEmbed, successEmbed } from '../lib/embeds'
import { voice } from '../voice'
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
      await ctx.reply({ embeds: [errorEmbed('Join a voice channel first, or pass one: `/home #lounge`.', 'Which channel?')] })
      return
    }
    const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null))
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await ctx.reply({ embeds: [errorEmbed('That is not a voice channel. Ume lives in regular voice channels (not stages).', 'Not a voice channel')] })
      return
    }
    const me = guild.members.me
    if (me && !channel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
      await ctx.reply({
        embeds: [errorEmbed(`I cannot **View**, **Connect** and **Speak** in <#${channel.id}>. Fix the channel permissions and try again.`, 'Missing permissions')],
      })
      return
    }

    const noticeChannelId =
      ws.noticeTextChannelId ?? (ctx.channel && 'guildId' in ctx.channel && ctx.channel.type === ChannelType.GuildText ? ctx.channel.id : null)
    await db
      .update(workspaces)
      .set({ homeVoiceChannelId: channel.id, noticeTextChannelId: noticeChannelId, updatedAt: new Date() })
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
    await touchActivity(db, ws.id, { kind: 'command', discordUserId: ctx.user.id, metadata: { command: 'home' } })

    try {
      await voice().join(guild, channel.id, ws.id)
    } catch (err) {
      await ctx.reply({ embeds: [errorEmbed(`Saved <#${channel.id}> as home, but joining failed: ${(err as Error).message}`, 'Could not join')] })
      return
    }
    await ctx.reply({
      embeds: [
        successEmbed(
          `<#${channel.id}> is my home now. I will stay here 24/7, pause when the room is empty, and follow if you drag me somewhere else.`,
          'Home set',
        ),
      ],
      ephemeral: false,
    })
  },
}
