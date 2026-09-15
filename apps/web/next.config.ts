import type { NextConfig } from 'next'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'

// All apps share one .env at the repo root.
loadEnv({ path: path.resolve(process.cwd(), '../../.env') })

const nextConfig: NextConfig = {
  transpilePackages: ['@ume/shared', '@ume/db', '@ume/storage', '@ume/email'],
  serverExternalPackages: ['postgres', 'pg-boss', '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
}

export default nextConfig
