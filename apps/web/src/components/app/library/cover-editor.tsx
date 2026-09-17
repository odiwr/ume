'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash, Upload } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { removePlaylistCover, setPlaylistCover } from '@/lib/app/actions/playlists'
import { cn } from '@/lib/utils'
import { CoverArt } from './cover-art'
import { COVER_MAX_BYTES, COVER_TYPES, isCoverContentType } from './playlist-cover-rules'

const ACCEPT = Object.keys(COVER_TYPES).join(',')

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error ?? `Request failed (${res.status}).`
  } catch {
    return `Request failed (${res.status}).`
  }
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage answered ${xhr.status}.`))
    xhr.onerror = () => reject(new Error('The connection dropped during the upload.'))
    xhr.send(file)
  })
}

/**
 * The cover at the top of a playlist, for members who can manage playlists: click (or
 * press Enter on) the cover to upload or replace it, or remove it.
 */
export function CoverEditor({
  workspaceId,
  playlistId,
  name,
  src,
  className,
}: {
  workspaceId: string
  playlistId: string
  name: string
  src: string | null
  className?: string
}) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  // A local preview is tied to the cover it replaces; once the refreshed page brings a new `src` it is dropped.
  const [preview, setPreview] = React.useState<{ url: string; over: string | null } | null>(null)
  const [progress, setProgress] = React.useState<number | null>(null)
  const [removing, startRemove] = React.useTransition()
  const busy = progress !== null || removing

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  async function upload(file: File) {
    if (!isCoverContentType(file.type)) {
      toast.error('Use a JPEG, PNG or WebP image.')
      return
    }
    if (file.size > COVER_MAX_BYTES) {
      toast.error('Cover images can be at most 5 MB.')
      return
    }
    setPreview({ url: URL.createObjectURL(file), over: src })
    setProgress(0)
    try {
      const presign = await fetch('/api/playlists/cover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          playlistId,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      })
      if (!presign.ok) throw new Error(await readError(presign))
      const { url, key } = (await presign.json()) as { url: string; key: string }
      await putWithProgress(url, file, setProgress)
      const saved = await setPlaylistCover(workspaceId, playlistId, key)
      if (!saved.ok) throw new Error(saved.error)
      toast.success('Cover updated.')
      router.refresh()
    } catch (err) {
      setPreview(null)
      toast.error(err instanceof Error ? err.message : 'Could not upload the cover.')
    } finally {
      setProgress(null)
    }
  }

  function remove() {
    startRemove(async () => {
      const res = await removePlaylistCover(workspaceId, playlistId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setPreview(null)
      toast.success('Cover removed.')
      router.refresh()
    })
  }

  const activePreview = preview && preview.over === src ? preview.url : null
  const shown = activePreview ?? src

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={shown ? `Replace the cover of ${name}` : `Upload a cover for ${name}`}
        className="group relative block w-full overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink disabled:cursor-wait"
      >
        <CoverArt name={name} src={shown} priority className="w-full" initialClassName="text-6xl" />
        <span
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-fg/55 text-sm font-medium text-bg transition-opacity motion-reduce:transition-none',
            progress !== null
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
          aria-live="polite"
        >
          {progress !== null ? (
            <>
              <span className="tabular-nums">{progress < 100 ? `${progress}%` : 'Saving'}</span>
              <span className="h-1 w-2/3 overflow-hidden rounded-full bg-bg/30">
                <span
                  className="block h-full rounded-full bg-bg transition-[width] motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </span>
            </>
          ) : (
            <>
              <Upload className="size-5" aria-hidden />
              {shown ? 'Replace cover' : 'Upload cover'}
            </>
          )}
        </span>
        {progress === null ? (
          <span
            aria-hidden
            className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-surface/90 text-fg transition-opacity group-hover:opacity-0 motion-reduce:transition-none"
          >
            <Upload className="size-4" />
          </span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void upload(file)
        }}
      />
      {src && !activePreview ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={remove}
          loading={removing}
          disabled={busy}
          className="self-start"
        >
          <Trash className="size-4" aria-hidden /> Remove cover
        </Button>
      ) : null}
    </div>
  )
}
