import { CAP } from './roles'

/**
 * The single source of truth for bot commands. The bot registers these as slash
 * commands AND matches them as `~` prefix messages; the marketing site's /commands
 * page renders from this list too.
 */
export type CommandScope = 'dm' | 'guild' | 'both'

export interface CommandOption {
  name: string
  description: string
  required: boolean
  type: 'string' | 'integer' | 'channel' | 'user'
}

export interface CommandSpec {
  name: string
  description: string
  scope: CommandScope
  /** Capability required inside a workspace (guild commands). */
  requires?: number
  /** Guild owner or Administrator required (claim/rotate/reset/purge). */
  requiresGuildAdmin?: boolean
  /** Only the guild owner (Discord) or the workspace Owner may run it. */
  requiresOwner?: boolean
  options: CommandOption[]
  examples: string[]
  category: 'setup' | 'library' | 'playback' | 'info'
}

export const COMMANDS: readonly CommandSpec[] = [
  {
    name: 'reload',
    description:
      'Issue a fresh Ume token for your server and disconnect the current web workspace until the new token is entered.',
    scope: 'dm',
    requiresGuildAdmin: true,
    options: [{ name: 'server', description: 'Server name (only needed if you admin several)', required: false, type: 'string' }],
    examples: ['~reload', '~reload My Cool Server'],
    category: 'setup',
  },
  {
    name: 'reset',
    description: 'Disconnect the workspace and remove every web member except the Owner. Buckets and music stay.',
    scope: 'dm',
    requiresOwner: true,
    options: [{ name: 'server', description: 'Server name', required: false, type: 'string' }],
    examples: ['~reset', '~reset My Cool Server'],
    category: 'setup',
  },
  {
    name: 'purge',
    description: 'Permanently delete the workspace: buckets, music, members, everything. Asks for a confirmation code.',
    scope: 'dm',
    requiresOwner: true,
    options: [{ name: 'server', description: 'Server name', required: false, type: 'string' }],
    examples: ['~purge', '~purge My Cool Server'],
    category: 'setup',
  },
  {
    name: 'confirm',
    description: 'Confirm a pending ~reset or ~purge with the code Ume sent you.',
    scope: 'dm',
    options: [{ name: 'code', description: 'The 6-character code', required: true, type: 'string' }],
    examples: ['~confirm K7Q2ZP'],
    category: 'setup',
  },
  {
    name: 'home',
    description: 'Set the voice channel Ume lives in 24/7 (defaults to the channel you are in).',
    scope: 'guild',
    requires: CAP.MANAGE_SETTINGS,
    options: [{ name: 'channel', description: 'Voice channel', required: false, type: 'channel' }],
    examples: ['~home', '~home #lounge'],
    category: 'setup',
  },
  {
    name: 'add',
    description: 'Add a YouTube link to a bucket. Ume pulls the title, artist and cover automatically.',
    scope: 'guild',
    requires: CAP.ADD_TRACK,
    options: [
      { name: 'bucket', description: 'Bucket name', required: true, type: 'string' },
      { name: 'url', description: 'YouTube video URL', required: true, type: 'string' },
    ],
    examples: ['~add city-pop https://www.youtube.com/watch?v=RMPX_vgqQnM'],
    category: 'library',
  },
  {
    name: 'buckets',
    description: 'List this server’s buckets and how many tracks each holds.',
    scope: 'guild',
    requires: CAP.VIEW_LIBRARY,
    options: [],
    examples: ['~buckets'],
    category: 'library',
  },
  {
    name: 'play',
    description: 'Play a bucket (shuffled) or search for a track by name.',
    scope: 'guild',
    requires: CAP.CONTROL_PLAYBACK,
    options: [{ name: 'query', description: 'Bucket name or track title', required: true, type: 'string' }],
    examples: ['~play rage', '~play plastic love'],
    category: 'playback',
  },
  {
    name: 'pause',
    description: 'Pause playback.',
    scope: 'guild',
    requires: CAP.CONTROL_PLAYBACK,
    options: [],
    examples: ['~pause'],
    category: 'playback',
  },
  {
    name: 'resume',
    description: 'Resume playback.',
    scope: 'guild',
    requires: CAP.CONTROL_PLAYBACK,
    options: [],
    examples: ['~resume'],
    category: 'playback',
  },
  {
    name: 'skip',
    description: 'Skip the current track.',
    scope: 'guild',
    requires: CAP.CONTROL_PLAYBACK,
    options: [],
    examples: ['~skip'],
    category: 'playback',
  },
  {
    name: 'stop',
    description: 'Stop playback and clear the queue. Ume stays in the channel.',
    scope: 'guild',
    requires: CAP.CONTROL_PLAYBACK,
    options: [],
    examples: ['~stop'],
    category: 'playback',
  },
  {
    name: 'queue',
    description: 'Show what is coming up.',
    scope: 'guild',
    requires: CAP.VIEW_LIBRARY,
    options: [],
    examples: ['~queue'],
    category: 'playback',
  },
  {
    name: 'np',
    description: 'What is playing right now, and who added it.',
    scope: 'guild',
    requires: CAP.VIEW_LIBRARY,
    options: [],
    examples: ['~np'],
    category: 'playback',
  },
  {
    name: 'link',
    description: 'Get a link to your web dashboard for this server.',
    scope: 'both',
    options: [],
    examples: ['~link'],
    category: 'info',
  },
  {
    name: 'status',
    description: 'Show Ume’s connection, storage use and activity for this server.',
    scope: 'guild',
    requires: CAP.VIEW_LIBRARY,
    options: [],
    examples: ['~status'],
    category: 'info',
  },
  {
    name: 'help',
    description: 'List commands you can use here.',
    scope: 'both',
    options: [],
    examples: ['~help'],
    category: 'info',
  },
] as const

export function findCommand(name: string): CommandSpec | undefined {
  return COMMANDS.find((c) => c.name === name.toLowerCase())
}
