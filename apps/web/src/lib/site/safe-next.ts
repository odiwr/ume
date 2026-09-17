/**
 * Only ever redirect to a relative path on this origin. Rejects protocol-relative
 * URLs (`//evil.com`), backslash tricks and anything that is not a plain path.
 */
export function safeNextPath(value: string | string[] | undefined, fallback = '/app'): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return fallback
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return fallback
  }
  if (!decoded.startsWith('/')) return fallback
  if (decoded.startsWith('//') || decoded.startsWith('/\\')) return fallback
  if (/[\s\x00-\x1f]/.test(decoded)) return fallback
  if (decoded.includes('://')) return fallback
  // Never bounce a fresh sign-in back to an auth page.
  if (decoded === '/login' || decoded.startsWith('/login?') || decoded === '/banned')
    return fallback
  return decoded
}
