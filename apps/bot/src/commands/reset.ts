import { findCommand } from '@ume/shared'
import type { Command } from './context'
import { requestDangerAction } from './danger-shared'

export const reset: Command = {
  spec: findCommand('reset')!,
  run: (ctx) =>
    requestDangerAction(ctx, 'reset', [
      'remove **every** web member except the Owner',
      'revoke all open invites and share links',
      'revoke any unclaimed Ume tokens',
      'disconnect the workspace (read-only) until you run `/reload` and enter a new token',
      '**keep** all playlists and music',
    ]),
}
