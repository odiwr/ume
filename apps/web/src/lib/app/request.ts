import 'server-only'
import { appUrl } from '@/lib/utils'

/**
 * Route handlers that are driven by plain HTML forms have no Server Action CSRF token,
 * so they check that the browser sent the request from our own origin.
 */
export function isSameOrigin(req: Request): boolean {
  const fetchSite = req.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false
  const origin = req.headers.get('origin')
  if (!origin) return fetchSite === 'same-origin' || fetchSite === 'none'
  try {
    const expected = new URL(appUrl('/')).origin
    const actual = new URL(origin).origin
    return actual === expected || actual === new URL(req.url).origin
  } catch {
    return false
  }
}
