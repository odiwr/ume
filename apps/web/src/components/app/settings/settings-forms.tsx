'use client'
import * as React from 'react'
import { ShieldCheck } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox'
import { Label, Select } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ATTESTATION_LABEL } from '@/components/app/claim-token-form'
import { Notice } from '@/components/app/page-header'
import { useAction } from '@/components/app/use-action'
import { acceptLinkAttestation, setLinkExtractEnabled, updateBotChannels } from '@/lib/app/actions/settings'

export interface ChannelOption {
  id: string
  name: string
}

export function BotChannelsForm({
  workspaceId,
  voice,
  text,
  homeVoiceChannelId,
  noticeTextChannelId,
  loadError,
}: {
  workspaceId: string
  voice: ChannelOption[]
  text: ChannelOption[]
  homeVoiceChannelId: string | null
  noticeTextChannelId: string | null
  loadError: string | null
}) {
  const [home, setHome] = React.useState(homeVoiceChannelId ?? '')
  const [notice, setNotice] = React.useState(noticeTextChannelId ?? '')
  const { run, pending } = useAction()
  const dirty = home !== (homeVoiceChannelId ?? '') || notice !== (noticeTextChannelId ?? '')

  if (loadError) return <Notice tone="info">{loadError}</Notice>

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => updateBotChannels(workspaceId, { homeVoiceChannelId: home || null, noticeTextChannelId: notice || null }), { success: 'Channels saved. The bot moves on its next heartbeat.' })
      }}
    >
      <div>
        <Label htmlFor="home-channel">Home voice channel</Label>
        <Select id="home-channel" value={home} onChange={(e) => setHome(e.target.value)}>
          <option value="">Follow whoever runs /home</option>
          {voice.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">Where Ume lives 24/7. Moving the bot in Discord updates this too.</p>
      </div>
      <div>
        <Label htmlFor="notice-channel">Notice text channel</Label>
        <Select id="notice-channel" value={notice} onChange={(e) => setNotice(e.target.value)}>
          <option value="">No channel notices</option>
          {text.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">Inactivity warnings and token rotations are announced here.</p>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" loading={pending} disabled={!dirty}>
          Save channels
        </Button>
      </div>
    </form>
  )
}

export function MusicSettings({
  workspaceId,
  enabled,
  globalFlagOn,
  acceptedAt,
  acceptedBy,
  isOwner,
}: {
  workspaceId: string
  enabled: boolean
  globalFlagOn: boolean
  acceptedAt: string | null
  acceptedBy: string | null
  isOwner: boolean
}) {
  const [attested, setAttested] = React.useState(false)
  const { run, pending } = useAction()
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
        <div className="min-w-0">
          <p className="font-medium">Add from link</p>
          <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">
            Members with “Add music” can paste a YouTube, SoundCloud, Bandcamp, Audius, Mixcloud, Vimeo or Internet Archive link. Ume extracts the audio, normalizes it and stores it like an upload. Switched off, links are saved as metadata-only entries.
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={pending}
          onCheckedChange={(v) => run(() => setLinkExtractEnabled(workspaceId, v), { success: v ? 'Add from link is on.' : 'Add from link is off. Links are saved without audio.' })}
          aria-label="Add from link"
        />
      </div>

      {!globalFlagOn ? (
        <Notice tone="warning">Adding audio from links is switched off on Ume right now, for every server. Links are saved as metadata-only entries until it is back.</Notice>
      ) : null}

      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="flex items-center gap-2 font-medium">
          <ShieldCheck className={`size-4 ${acceptedAt ? 'text-success' : 'text-fg-muted'}`} aria-hidden /> Rights attestation
        </p>
        {acceptedAt ? (
          <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">
            Accepted{acceptedBy ? ` by ${acceptedBy}` : ''} on {new Date(acceptedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. Ume stores audio from links for this server.
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-xs text-fg-muted [text-wrap:pretty]">
              Not accepted yet, so links are saved without audio. {isOwner ? 'Accepting it turns the extractor on for this server.' : 'Only the workspace Owner can accept it.'}
            </p>
            {isOwner ? (
              <>
                <CheckboxField id="settings-attestation" checked={attested} onCheckedChange={(v) => setAttested(v === true)} label={ATTESTATION_LABEL} description="Takedown notices disable the track and block its content across Ume." />
                <Button size="sm" loading={pending} disabled={!attested} onClick={() => run(() => acceptLinkAttestation(workspaceId, attested), { success: 'Attestation accepted.' })}>
                  Accept
                </Button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
