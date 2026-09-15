import { EmbedBuilder, type APIEmbedField } from 'discord.js'
import { BRAND } from '@ume/shared'
import { env } from './env'

export const PINK = 0xe464b0
export const DANGER = 0xef4444
export const SUCCESS = 0x22c55e

export function artworkUrl(): string {
  return `${env.appUrl}/brand/ume-artwork.png`
}

export interface UmeEmbedInput {
  title?: string
  description?: string
  fields?: APIEmbedField[]
  color?: number
  /** Override the Ume mark thumbnail (e.g. a YouTube cover). `null` hides it. */
  thumbnail?: string | null
  footer?: string
  url?: string
  timestamp?: boolean
}

/** Every Ume reply uses the same pink card with the mark as thumbnail. */
export function umeEmbed(input: UmeEmbedInput): EmbedBuilder {
  const e = new EmbedBuilder().setColor(input.color ?? PINK)
  if (input.title) e.setTitle(input.title)
  if (input.description) e.setDescription(input.description)
  if (input.fields?.length) e.addFields(input.fields)
  if (input.url) e.setURL(input.url)
  if (input.thumbnail !== null) e.setThumbnail(input.thumbnail ?? artworkUrl())
  e.setFooter({ text: input.footer ?? `${BRAND.name} — ${BRAND.tagline}` })
  if (input.timestamp) e.setTimestamp()
  return e
}

export function errorEmbed(description: string, title = 'Something went wrong'): EmbedBuilder {
  return umeEmbed({ title, description, color: DANGER, thumbnail: null })
}

export function successEmbed(description: string, title?: string): EmbedBuilder {
  return umeEmbed({ title, description, color: SUCCESS, thumbnail: null })
}

export function formatMs(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** Discord relative timestamp, e.g. "in 5 minutes" / "3 days ago". */
export function relTime(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
