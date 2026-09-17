/** Limits for playlist cover images, shared by the picker, the presign route and the save action. */
export const COVER_MAX_BYTES = 5 * 1024 * 1024

export const COVER_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

export type CoverContentType = keyof typeof COVER_TYPES

export function isCoverContentType(value: string): value is CoverContentType {
  return Object.hasOwn(COVER_TYPES, value)
}
