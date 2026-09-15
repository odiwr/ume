import type { Command } from './context'
import { add } from './add'
import { playlists } from './playlists'
import { confirm } from './confirm'
import { help } from './help'
import { home } from './home'
import { link } from './link'
import { np } from './np'
import { pause } from './pause'
import { play } from './play'
import { purge } from './purge'
import { queue } from './queue'
import { reload } from './reload'
import { reset } from './reset'
import { resume } from './resume'
import { skip } from './skip'
import { status } from './status'
import { stop } from './stop'

export const commands: readonly Command[] = [
  reload,
  reset,
  purge,
  confirm,
  home,
  add,
  playlists,
  play,
  pause,
  resume,
  skip,
  stop,
  queue,
  np,
  link,
  status,
  help,
]

export const commandMap = new Map(commands.map((c) => [c.spec.name, c]))
