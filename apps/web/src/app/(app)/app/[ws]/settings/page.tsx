import type { Metadata } from 'next'
import { KeyRound } from '@/components/ui/icons'
import { getFlag } from '@ume/db'
import { CAP } from '@ume/shared'
import { Badge } from '@/components/ui/badge'
import { ClaimTokenForm } from '@/components/app/claim-token-form'
import { CopyButton } from '@/components/app/copy-button'
import { Notice, PageHeader, Section } from '@/components/app/page-header'
import { DangerZone } from '@/components/app/settings/danger-zone'
import {
  BotChannelsForm,
  MusicSettings,
  type ChannelOption,
} from '@/components/app/settings/settings-forms'
import { db } from '@/lib/db'
import { getGuildChannels } from '@/lib/discord-api'
import { displayName, workspaceStatusTone } from '@/lib/app/format'
import { listMembers, usersByIds } from '@/lib/app/queries'
import { requireWorkspacePage } from '@/lib/app/workspace'

export const metadata: Metadata = { title: 'Settings', robots: { index: false } }

export default async function SettingsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const { workspace, access } = await requireWorkspacePage(umeId, CAP.MANAGE_SETTINGS)
  const status = workspaceStatusTone(workspace.status)

  let voice: ChannelOption[] = []
  let text: ChannelOption[] = []
  let channelError: string | null = null
  if (workspace.botInGuild) {
    try {
      const channels = await getGuildChannels(workspace.guildId)
      voice = channels.voice.map((c) => ({ id: c.id, name: c.name }))
      text = channels.text.map((c) => ({ id: c.id, name: c.name }))
      if (!voice.length && !text.length)
        channelError =
          'Ume could not read this server’s channels. Check that the bot is still in the server.'
    } catch {
      channelError = 'Could not reach Discord to list channels. Try again in a moment.'
    }
  } else {
    channelError =
      'Ume is not in this Discord server yet. Add the bot from the server picker, then pick its home channel here.'
  }

  const [globalFlagOn, members, acceptedBy] = await Promise.all([
    getFlag(db, 'link_extract'),
    access.isOwner ? listMembers(workspace.id) : Promise.resolve([]),
    workspace.linkExtractAcceptedByUserId
      ? usersByIds([workspace.linkExtractAcceptedByUserId])
      : Promise.resolve(new Map()),
  ])
  const acceptedByUser = workspace.linkExtractAcceptedByUserId
    ? acceptedBy.get(workspace.linkExtractAcceptedByUserId)
    : null

  return (
    <>
      <PageHeader title="Settings" />

      <Section id="general" title="General">
        <div
          data-tinted=""
          className="grid gap-5 rounded-2xl bg-surface-2 p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
              Ume ID
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 truncate rounded-lg bg-surface px-2 py-1 font-mono text-xs">
                {workspace.umeId}
              </code>
              <CopyButton value={workspace.umeId} label="Copy Ume ID" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
              Discord server
            </p>
            <p className="mt-1 truncate text-sm">{workspace.guildName}</p>
            <p className="mt-0.5 font-mono text-xs text-fg-muted">{workspace.guildId}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
              Status
            </p>
            <p className="mt-1">
              <Badge tone={status.tone}>{status.label}</Badge>
            </p>
          </div>
        </div>
      </Section>

      <Section id="connection" title="Connection">
        <div data-tinted="" className="rounded-2xl bg-surface-2 p-5">
          {workspace.status === 'disconnected' ? (
            <Notice tone="warning" className="mb-5" icon={<KeyRound className="size-4" />}>
              Disconnected. Nothing can change until a new token is entered.
            </Notice>
          ) : (
            <p className="mb-5 text-sm text-fg-muted [text-wrap:pretty]">
              Only needed after someone runs /reload in Discord.
            </p>
          )}
          <ClaimTokenForm
            returnTo={`/app/${umeId}/settings`}
            submitLabel="Reconnect with this token"
            compact
          />
        </div>
      </Section>

      <Section id="bot" title="Bot">
        <div data-tinted="" className="rounded-2xl bg-surface-2 p-5">
          <BotChannelsForm
            workspaceId={workspace.id}
            voice={voice}
            text={text}
            homeVoiceChannelId={workspace.homeVoiceChannelId}
            noticeTextChannelId={workspace.noticeTextChannelId}
            loadError={channelError}
          />
        </div>
      </Section>

      <Section id="music" title="Music">
        <MusicSettings
          workspaceId={workspace.id}
          enabled={workspace.linkExtractEnabled}
          globalFlagOn={globalFlagOn}
          acceptedAt={
            workspace.linkExtractAcceptedAt ? workspace.linkExtractAcceptedAt.toISOString() : null
          }
          acceptedBy={acceptedByUser ? displayName(acceptedByUser) : null}
          isOwner={access.isOwner}
        />
      </Section>

      {access.isOwner ? (
        <Section id="danger" title="Danger zone">
          <DangerZone
            workspaceId={workspace.id}
            guildName={workspace.guildName}
            memberCount={members.length}
            status={workspace.status}
          />
        </Section>
      ) : null}
    </>
  )
}
