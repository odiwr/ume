import { CAP_LABELS, COMMANDS, COMMAND_PREFIX, capNames, type CommandSpec } from '@ume/shared'
import { Badge, type BadgeTone } from '@/components/ui/badge'

export const COMMAND_CATEGORIES: Record<CommandSpec['category'], { title: string; blurb: string }> = {
  setup: {
    title: 'Setup & safety',
    blurb: 'Claiming, reconnecting and the three destructive commands. Replies are private; the dangerous ones ask for a code.',
  },
  library: {
    title: 'Library',
    blurb: 'Add links and browse playlists from Discord. Uploads happen on the web.',
  },
  playback: {
    title: 'Playback',
    blurb: 'Control what the channel hears. Ume stays connected no matter what you press.',
  },
  info: {
    title: 'Info',
    blurb: 'Links, status and help.',
  },
}

export const CATEGORY_ORDER: CommandSpec['category'][] = ['setup', 'library', 'playback', 'info']

export function commandsByCategory(): { category: CommandSpec['category']; commands: CommandSpec[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    commands: COMMANDS.filter((c) => c.category === category),
  })).filter((g) => g.commands.length > 0)
}

export function slashForm(c: CommandSpec): string {
  const opts = c.options.map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(' ')
  return `/${c.name}${opts ? ` ${opts}` : ''}`
}

export function prefixForm(c: CommandSpec): string {
  return `${COMMAND_PREFIX}${c.name}`
}

export function scopeLabel(c: CommandSpec): { text: string; tone: BadgeTone } {
  switch (c.scope) {
    case 'dm':
      return { text: 'DM or server', tone: 'beige' }
    case 'guild':
      return { text: 'Server', tone: 'sage' }
    case 'both':
      return { text: 'Server or DM', tone: 'default' }
  }
}

export function whoCanRun(c: CommandSpec): string {
  if (c.requiresOwner) return 'Server owner or workspace Owner'
  if (c.requiresGuildAdmin) return 'Server owner or Administrator'
  if (c.requires) {
    const names = capNames(c.requires).map((n) => CAP_LABELS[n].label)
    return names.length ? `Anyone who can: ${names.join(', ').toLowerCase()}` : 'Any member'
  }
  if (c.name === 'confirm') return 'Whoever ran the pending reset or purge'
  return 'Anyone'
}

export function CommandRow({ command, compact }: { command: CommandSpec; compact?: boolean }) {
  const scope = scopeLabel(command)
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-surface-3 px-2 py-1 font-mono text-sm text-fg">{slashForm(command)}</code>
        <span className="text-xs text-fg-subtle">or</span>
        <code className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-sm text-fg-muted">{prefixForm(command)}</code>
        <Badge tone={scope.tone} className="ml-auto">
          {scope.text}
        </Badge>
      </div>
      <p className="text-sm leading-relaxed text-fg-muted">{command.description}</p>
      {!compact ? (
        <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold uppercase tracking-wide text-fg-subtle">Who</dt>
          <dd className="text-fg-muted">{whoCanRun(command)}</dd>
          {command.options.length ? (
            <>
              <dt className="font-semibold uppercase tracking-wide text-fg-subtle">Options</dt>
              <dd className="flex flex-col gap-1 text-fg-muted">
                {command.options.map((o) => (
                  <span key={o.name}>
                    <code className="font-mono text-fg">{o.name}</code>
                    {o.required ? '' : ' (optional)'} — {o.description}
                  </span>
                ))}
              </dd>
            </>
          ) : null}
          {command.examples.length ? (
            <>
              <dt className="font-semibold uppercase tracking-wide text-fg-subtle">Example</dt>
              <dd className="flex flex-wrap gap-2">
                {command.examples.map((e) => (
                  <code key={e} className="rounded-md bg-bg px-1.5 py-0.5 font-mono text-fg-muted">
                    {e}
                  </code>
                ))}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </li>
  )
}
