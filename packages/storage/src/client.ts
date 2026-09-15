import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Readable } from 'node:stream'

/**
 * S3-compatible object storage. Cloudflare R2 is the intended target (zero egress
 * fees matter for a bot that streams audio all day), but any S3 endpoint works.
 *
 * Env: S3_ENDPOINT, S3_REGION (auto for R2), S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *      S3_PUBLIC_BASE_URL (optional, for public covers via a custom domain)
 */
export interface StorageConfig {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl?: string
}

export function storageConfigFromEnv(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const required = (k: string) => {
    const v = env[k]
    if (!v) throw new Error(`${k} is not set`)
    return v
  }
  return {
    endpoint: required('S3_ENDPOINT'),
    region: env.S3_REGION ?? 'auto',
    bucket: required('S3_BUCKET'),
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    publicBaseUrl: env.S3_PUBLIC_BASE_URL || undefined,
  }
}

export class Storage {
  readonly client: S3Client
  readonly bucket: string
  readonly publicBaseUrl: string | undefined

  constructor(cfg: StorageConfig) {
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    })
    this.bucket = cfg.bucket
    this.publicBaseUrl = cfg.publicBaseUrl
  }

  /** Browser uploads go straight to storage; the web server never proxies bytes. */
  presignUpload(key: string, contentType: string, contentLength: number, expiresInSec = 600): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
      { expiresIn: expiresInSec },
    )
  }

  presignDownload(key: string, expiresInSec = 3600, filename?: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
      }),
      { expiresIn: expiresInSec },
    )
  }

  publicUrl(key: string): string | null {
    return this.publicBaseUrl ? `${this.publicBaseUrl.replace(/\/$/, '')}/${key}` : null
  }

  async putObject(key: string, body: Buffer | Uint8Array | Readable, contentType: string, contentLength?: number): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ContentLength: contentLength }),
    )
  }

  async getObjectStream(key: string): Promise<{ stream: Readable; contentLength?: number; contentType?: string }> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    if (!res.Body) throw new Error(`Object ${key} has no body`)
    return { stream: res.Body as Readable, contentLength: res.ContentLength, contentType: res.ContentType }
  }

  async head(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return { size: res.ContentLength ?? 0, contentType: res.ContentType }
    } catch (err) {
      if ((err as { name?: string }).name === 'NotFound') return null
      throw err
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async deleteObjects(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000)
      if (!chunk.length) continue
      await this.client.send(
        new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }),
      )
    }
  }

  /** Delete everything under a prefix (used by purge). Returns number of objects deleted. */
  async deletePrefix(prefix: string): Promise<number> {
    let token: string | undefined
    let deleted = 0
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      )
      const keys = (page.Contents ?? []).map((o) => o.Key!).filter(Boolean)
      if (keys.length) {
        await this.deleteObjects(keys)
        deleted += keys.length
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (token)
    return deleted
  }
}

let cached: Storage | null = null
export function getStorage(): Storage {
  if (!cached) cached = new Storage(storageConfigFromEnv())
  return cached
}
