import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/register-commands.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Bundle our workspace packages; leave node_modules external.
  noExternal: ['@ume/shared', '@ume/db', '@ume/storage', '@ume/email'],
})
