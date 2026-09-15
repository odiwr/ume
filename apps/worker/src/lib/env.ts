/** Worker environment. Everything is optional except the database URL (read by @ume/shared). */
export const env = {
  appUrl: (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? '',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  ffprobePath:
    process.env.FFPROBE_PATH ||
    (process.env.FFMPEG_PATH && /ffmpeg(\.exe)?$/i.test(process.env.FFMPEG_PATH)
      ? process.env.FFMPEG_PATH.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1')
      : 'ffprobe'),
  ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp',
  ytdlpCookies: process.env.YTDLP_COOKIES || '',
}

export function dashboardUrl(umeId: string): string {
  return `${env.appUrl}/app/${umeId}`
}

export function settingsUrl(umeId: string): string {
  return `${env.appUrl}/app/${umeId}/settings`
}
