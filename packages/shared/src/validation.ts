import { z } from 'zod'
import { BUCKET, INVITE, UPLOAD } from './constants'
import { parseYouTubeId } from './discord'

export const bucketNameSchema = z
  .string()
  .trim()
  .min(BUCKET.nameMinLength, 'Give the bucket a name.')
  .max(BUCKET.nameMaxLength, `Keep it under ${BUCKET.nameMaxLength} characters.`)
  .regex(/^[\p{L}\p{N}\p{Emoji} _\-&'!.]+$/u, 'Letters, numbers, spaces and simple punctuation only.')

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'bucket'
}

export const youtubeUrlSchema = z
  .string()
  .trim()
  .refine((v) => parseYouTubeId(v) !== null, 'That does not look like a YouTube video link.')

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
  bucketId: z.string().min(1),
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
