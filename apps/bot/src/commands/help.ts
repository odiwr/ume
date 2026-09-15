import { ALL_CAPS, COMMANDS, COMMAND_PREFIX, findCommand, hasCap, type CommandSpec } from '@ume/shared'
import { env } from '../lib/env'
import { umeEmbed } from '../lib/embeds'
import { commandMap } from './index'
import type { Command, CommandContext } from './context'

const CATEGORY_LABEL: Record<CommandSpec['category'], string> = {
  setup: 'Setup',
  library: 'Library',
  playback: 'Playback',
  info: 'Info',
}

function usable(ctx: CommandContext, spec: CommandSpec): boolean {
  if (!ctx.guild) return spec.scope !== 'guild'
  if (spec.requiresGuildAdmin) return ctx.isGuildAdmin
  if (spec.requiresOwner) {
    return ctx.guild.ownerId === ctx.user.id || (!!ctx.access?.user && ctx.access.workspace.ownerUserId === ctx.access.user.id)
  }
  if (spec.requires) {
    const caps = ctx.isGuildAdmin ? ALL_CAPS : (ctx.access?.caps ?? 0)
    return hasCap(caps, spec.requires)
  }
  return true
}

export const help: Command = {
  spec: findCommand('help')!,
  async run(ctx) {
    const visible = COMMANDS.filter((c) => commandMap.has(c.name) && usable(ctx, c))
    const fields = (Object.keys(CATEGORY_LABEL) as CommandSpec['category'][])
      .map((cat) => {
        const items = visible.filter((c) => c.category === cat)
        if (!items.length) return null
        return {
          name: CATEGORY_LABEL[cat],
          value: items
            .map((c) => {
              const opts = c.options.map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(' ')
              return `\`/${c.name}${opts ? ` ${opts}` : ''}\` · \`${COMMAND_PREFIX}${c.name}\` — ${c.description}`
            })
            .join('\n'),
        }
      })
      .filter((f): f is { name: string; value: string } => !!f)

    const where = ctx.guild
      ? env.messageContentIntent
        ? 'Slash commands and `~` both work here.'
        : 'Use slash commands here; `~` commands work in my DMs.'
      : 'In DMs, `~reload`, `~reset`, `~purge` and `~confirm` work on the servers you own or administer.'

    await ctx.reply({
      embeds: [
        umeEmbed({
          title: 'Ume commands you can use here',
          description: `${where}\nDashboard: ${env.appUrl}/app`,
          fields: fields.length ? fields : [{ name: 'Nothing yet', value: 'Sign in at the dashboard to link your Discord account and get a role.' }],
        }),
      ],
    })
  },
}
