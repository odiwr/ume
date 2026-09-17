// Preloaded by the `test` script (`node --import ./test/register.mjs`). Installs the resolve
// hook below so Node's native type stripping can load this package's extensionless ESM
// imports (`./constants`), which tsc resolves with moduleResolution "Bundler".
import { register } from 'node:module'

register('./resolve-ts.mjs', import.meta.url)
