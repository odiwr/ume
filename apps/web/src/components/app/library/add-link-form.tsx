'use client'
import * as React from 'react'
import { Link2 } from '@/components/ui/icons'
import { toast } from 'sonner'
import { SUPPORTED_LINK_SITES, parseMediaLink } from '@ume/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAction } from '@/components/app/use-action'
import { addLinkToPlaylist } from '@/lib/app/actions/tracks'

/**
 * "Add from link": paste a link to a single track. Extraction happens in the worker when
 * the workspace allows it; otherwise the song is saved as a metadata-only entry and
 * the server action explains why.
 */
export function AddLinkForm({ workspaceId, playlistId, disabled, extractionNotice }: { workspaceId: string; playlistId: string; disabled?: boolean; extractionNotice: string | null }) {
  const [url, setUrl] = React.useState('')
  const [touched, setTouched] = React.useState(false)
  const { run, pending } = useAction()
  const parsed = url.trim() ? parseMediaLink(url) : null
  const invalid = touched && url.trim().length > 0 && !parsed
  const siteLabel = parsed ? (SUPPORTED_LINK_SITES.find((s) => s.site === parsed.site)?.label ?? 'Link') : null

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setTouched(true)
        if (!parsed) return
        const res = await run(() => addLinkToPlaylist(workspaceId, playlistId, url), {
          success: (d) => (d.extracting ? `Added “${d.title}”. Ume is fetching the audio.` : `Added “${d.title}”.`),
        })
        if (res.ok) {
          if (res.data.notice) toast.warning(res.data.notice, { duration: 8000 })
          setUrl('')
          setTouched(false)
        }
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Paste a YouTube, SoundCloud, Bandcamp or Audius link"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled || pending}
            aria-invalid={invalid || undefined}
            aria-describedby="add-link-help"
            className={`pl-9 ${invalid ? 'border-danger' : ''}`}
          />
        </div>
        <Button type="submit" loading={pending} disabled={disabled || !parsed} className="shrink-0">
          Add {siteLabel ? `from ${siteLabel}` : 'from link'}
        </Button>
      </div>
      <p id="add-link-help" className={`text-xs [text-wrap:pretty] ${invalid ? 'text-danger' : 'text-fg-muted'}`}>
        {invalid
          ? 'That link is not a single track from a supported site. Playlists, albums and sets are not accepted.'
          : extractionNotice ?? `One link, one song. Supported: ${SUPPORTED_LINK_SITES.map((s) => s.label).join(', ')}.`}
      </p>
    </form>
  )
}
