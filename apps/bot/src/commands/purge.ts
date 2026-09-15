import { findCommand } from '@ume/shared'
import type { Command } from './context'
import { requestDangerAction } from './danger-shared'

export const purge: Command = {
  spec: findCommand('purge')!,
  run: (ctx) =>
    requestDangerAction(ctx, 'purge', [
      'stop playback and leave the voice channel',
      'permanently delete **every** playlist and track, including uploaded audio',
      'remove every member, invite and role',
      'cancel any storage subscription at the end of the period',
      '**This cannot be undone.**',
    ]),
}
