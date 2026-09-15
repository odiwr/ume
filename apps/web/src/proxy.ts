import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Cheap cookie-presence gate for private areas. Real authorization happens in the
 * server layouts (requireUser / requireCeo / getAccess) on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cookie = getSessionCookie(request)
  if (!cookie) {
    if (pathname.startsWith('/ceo') && pathname !== '/ceo/login') {
      return NextResponse.redirect(new URL('/ceo/login', request.url))
    }
    if (pathname.startsWith('/app')) {
      const url = new URL('/login', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/app/:path*', '/ceo/:path*'],
}
