import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.join(os.tmpdir(), 'ume')

/**
 * Runs `fn` with a private scratch directory under $TMPDIR/ume/<prefix>-XXXXXX and
 * removes it afterwards, whatever happens. Every job that touches disk goes through here.
 */
export async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  await mkdir(ROOT, { recursive: true })
  const dir = await mkdtemp(path.join(ROOT, `${prefix.replace(/[^\w-]+/g, '_')}-`))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export const tmpRoot = ROOT
