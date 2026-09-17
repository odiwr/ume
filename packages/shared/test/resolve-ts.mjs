import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Map a relative, extensionless specifier to its `.ts` file when one exists. */
export async function resolve(specifier, context, next) {
  if (/^\.\.?\//.test(specifier) && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL)
    if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context)
  }
  return next(specifier, context)
}
