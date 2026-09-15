/**
 * Environment access in one place so a missing variable fails loudly at boot,
 * not on the first command three hours later.
 */
export function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} is not set (see .env.example)`)
  return v
}

export const env = {
  get botToken() {
    return requireEnv('DISCORD_BOT_TOKEN')
  },
  get clientId() {
    return requireEnv('DISCORD_CLIENT_ID')
  },
  get devGuildId(): string | undefined {
    return process.env.DISCORD_DEV_GUILD_ID || undefined
  },
  /** `~` commands in guild channels need the privileged Message Content intent. */
  get messageContentIntent(): boolean {
    return process.env.DISCORD_MESSAGE_CONTENT_INTENT === 'true'
  },
  get appUrl(): string {
    return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  },
  get supportInvite(): string | undefined {
    return process.env.NEXT_PUBLIC_DISCORD_SUPPORT_INVITE || undefined
  },
}
