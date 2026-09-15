import { z } from 'zod'
import { PLAYLIST, INVITE, UPLOAD } from './constants'
import { parseMediaLink } from './links'

export const playlistNameSchema = z
  .string()
  .trim()
  .min(PLAYLIST.nameMinLength, 'Give the playlist a name.')
  .max(PLAYLIST.nameMaxLength, `Keep it under ${PLAYLIST.nameMaxLength} characters.`)
  .regex(/^[\p{L}\p{N}\p{Emoji} _\-&'!.]+$/u, 'Letters, numbers, spaces and simple punctuation only.')

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'playlist'
}

export const mediaLinkSchema = z
  .string()
  .trim()
  .refine(
    (v) => parseMediaLink(v) !== null,
    'Paste a link to a single track from YouTube, SoundCloud, Bandcamp, Audius, Mixcloud, Vimeo, the Internet Archive, or a direct audio file.',
  )

export const emailSchema = z.string().trim().toLowerCase().email()

export const inviteCreateSchema = z.object({
  kind: z.enum(['link', 'email']),
  roleId: z.string().min(1),
  email: emailSchema.optional(),
  expiresInDays: z.number().int().min(1).max(INVITE.maxExpiryDays).default(INVITE.defaultExpiryDays),
  maxUses: z.number().int().min(1).max(10_000).nullable().default(null),
  membershipExpiresAt: z.coerce.date().nullable().default(null),
  requireGuildMember: z.boolean().default(true),
})

export const uploadRequestSchema = z.object({
  playlistId: z.string().min(1),
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(UPLOAD.maxOriginalBytes),
  mimeType: z.string().min(1),
})

export const trackMetaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).nullable(),
  album: z.string().trim().max(200).nullable(),
})

export const roleUpsertSchema = z.object({
  name: z.string().trim().min(1).max(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#B3B3B3'),
  capabilities: z.number().int().nonnegative(),
})
