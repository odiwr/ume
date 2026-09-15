import type { MetadataRoute } from 'next'
import { appUrl } from '@/lib/utils'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app', '/app/', '/ceo', '/ceo/', '/api/', '/login', '/banned', '/invite/'],
      },
    ],
    sitemap: appUrl('/sitemap.xml'),
  }
}
