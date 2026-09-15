import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import { BRAND, botInviteUrl } from '@ume/shared'
import { closeDb, db, getWorkspaceByGuildId, setBotPresence } from './lib/db'
import { env } from './lib/env'
import { logger } from './lib/logger'
import { umeEmbed } from './lib/embeds'
import { stopQueue } from './lib/queue'
import { handleInteraction, handleMessage } from './commands/router'
import { VoiceManager, setVoiceManager } from './voice'
import { onVoiceStateUpdate as activityVoiceState, startupScan } from './activity'

const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages]
if (env.messageContentIntent) intents.push(GatewayIntentBits.MessageContent)

const client = new Client({
  intents,
  // Partials.Channel is required to receive DM messages (DM channels are not cached).
  partials: [Partials.Channel],
  allowedMentions: { parse: [], repliedUser: false },
})

let voice: VoiceManager | null = null

client.once(Events.ClientReady, async (ready) => {
  logger.info({ user: ready.user.tag, guilds: ready.guilds.cache.size, prefixInGuilds: env.messageContentIntent }, `${BRAND.name} is online`)
  ready.user.setPresence({ activities: [{ name: '/help · ume', type: 2 }], status: 'online' })
  try {
    voice = new VoiceManager(ready)
    setVoiceManager(voice)
    await voice.start()
    await startupScan(ready, voice)
  } catch (err) {
    logger.error({ err }, 'voice manager failed to start')
  }
})

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteraction(interaction)
})

client.on(Events.MessageCreate, (message) => {
  if (!client.isReady()) return
  void handleMessage(client, message)
})

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (!voice) return
  voice.onVoiceStateUpdate(oldState, newState).catch((err) => logger.error({ err }, 'voice state handler failed'))
  activityVoiceState(voice, oldState, newState).catch((err) => logger.error({ err }, 'activity handler failed'))
})

client.on(Events.ChannelDelete, (channel) => {
  if (!voice || channel.isDMBased()) return
  voice.onChannelDelete(channel.guildId, channel.id).catch((err) => logger.error({ err }, 'channelDelete handler failed'))
})

client.on(Events.GuildCreate, async (guild) => {
  try {
    logger.info({ guildId: guild.id, name: guild.name }, 'joined guild')
    const ws = await getWorkspaceByGuildId(db, guild.id)
    if (ws) {
      await setBotPresence(db, guild.id, { connected: false, inGuild: true })
      if (ws.homeVoiceChannelId && voice && ws.status !== 'purged' && ws.status !== 'purging') {
        voice.join(guild, ws.homeVoiceChannelId, ws.id).catch((err) => logger.warn({ err, guildId: guild.id }, 'rejoin on guildCreate failed'))
      }
      return
    }
    // No row yet: /reload or the web claim creates it. Just say hello.
    const ch = guild.systemChannel
    if (ch?.isSendable()) {
      await ch.send({
        embeds: [
          umeEmbed({
            title: `Thanks for adding ${BRAND.name}`,
            description: [
              'Two ways to set up your server’s music workspace:',
              '',
              `**1.** Sign in with Discord at ${env.appUrl}/app and pick this server.`,
              '**2.** Run `/reload` here for a single-use token, then enter it on the web.',
              '',
              'Then join a voice channel and run `/home` so I know where to live.',
            ].join('\n'),
          }),
        ],
      })
    }
  } catch (err) {
    logger.error({ err, guildId: guild.id }, 'guildCreate handler failed')
  }
})

client.on(Events.GuildDelete, async (guild) => {
  try {
    logger.info({ guildId: guild.id }, 'removed from guild')
    voice?.leave(guild.id)
    await setBotPresence(db, guild.id, { connected: false, voiceChannelId: null, inGuild: false })
  } catch (err) {
    logger.error({ err, guildId: guild.id }, 'guildDelete handler failed')
  }
})

client.on(Events.Error, (err) => logger.error({ err }, 'client error'))
client.on(Events.Warn, (msg) => logger.warn(msg))
client.rest.on('rateLimited', (info) => logger.warn({ info }, 'rate limited'))

process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'))
process.on('uncaughtException', (err) => logger.error({ err }, 'uncaught exception'))

let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'shutting down')
  const timer = setTimeout(() => process.exit(1), 10_000)
  try {
    await voice?.shutdown()
    await stopQueue()
    await client.destroy()
    await closeDb()
  } catch (err) {
    logger.error({ err }, 'shutdown error')
  } finally {
    clearTimeout(timer)
    process.exit(0)
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

client.login(env.botToken).catch((err) => {
  logger.fatal({ err }, 'login failed — check DISCORD_BOT_TOKEN')
  process.exit(1)
})

if (process.env.DISCORD_CLIENT_ID) logger.info({ inviteUrl: botInviteUrl(process.env.DISCORD_CLIENT_ID) }, 'invite url')
