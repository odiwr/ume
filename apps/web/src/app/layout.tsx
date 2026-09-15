import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: { default: 'Ume — the 24/7 Discord music bot with a real library', template: '%s · Ume' },
  description:
    'Ume lives in your voice channel around the clock. Build buckets of music with your community, upload your own tracks, and manage everything from the web.',
  icons: { icon: '/brand/ume-logo.svg' },
  openGraph: {
    title: 'Ume — the 24/7 Discord music bot with a real library',
    description: 'A music bot that never leaves the room, with a web library your whole server can curate.',
    images: ['/brand/ume-artwork.png'],
  },
}

export const viewport: Viewport = { themeColor: '#0a0a0a' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-dvh bg-bg text-fg antialiased">{children}</body>
    </html>
  )
}
