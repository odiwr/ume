'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { CloudUpload, FileMusic, X } from '@/components/ui/icons'
import { toast } from 'sonner'
import { UPLOAD, formatBytes } from '@ume/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UploadState = 'queued' | 'presigning' | 'uploading' | 'finishing' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  state: UploadState
  progress: number
  error: string | null
}

const ACCEPT: Record<string, string[]> = Object.fromEntries(UPLOAD.acceptedMimeTypes.map((m) => [m, UPLOAD.acceptedExtensions.map((e) => `.${e}`)]))
const PARALLEL = 2

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error ?? `Request failed (${res.status}).`
  } catch {
    return `Request failed (${res.status}).`
  }
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage answered ${xhr.status}.`)))
    xhr.onerror = () => reject(new Error('The connection dropped during the upload.'))
    xhr.onabort = () => reject(new Error('Upload cancelled.'))
    xhr.send(file)
  })
}

/**
 * Drag-and-drop uploads. Each file: presign -> PUT straight to storage with progress
 * -> complete (queues the transcode). Failures are reported back so the server can
 * release the reserved quota.
 */
export function Uploader({ workspaceId, playlistId, disabled, disabledReason }: { workspaceId: string; playlistId: string; disabled?: boolean; disabledReason?: string }) {
  const router = useRouter()
  const [items, setItems] = React.useState<UploadItem[]>([])
  const queueRef = React.useRef<UploadItem[]>([])
  const activeRef = React.useRef(0)

  const update = React.useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const uploadOne = React.useCallback(
    async (item: UploadItem) => {
      let trackId: string | null = null
      try {
        update(item.id, { state: 'presigning' })
        const presign = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workspaceId, playlistId, filename: item.file.name, sizeBytes: item.file.size, mimeType: item.file.type || 'application/octet-stream' }),
        })
        if (!presign.ok) throw new Error(await readError(presign))
        const { trackId: id, url } = (await presign.json()) as { trackId: string; url: string }
        trackId = id
        update(item.id, { state: 'uploading', progress: 0 })
        await putWithProgress(url, item.file, (pct) => update(item.id, { progress: pct }))
        update(item.id, { state: 'finishing', progress: 100 })
        const complete = await fetch('/api/upload/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ trackId }),
        })
        if (!complete.ok) throw new Error(await readError(complete))
        update(item.id, { state: 'done' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.'
        update(item.id, { state: 'error', error: message })
        if (trackId) {
          // Tell the server so the reservation is released; ignore failures here.
          fetch('/api/upload/complete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ trackId, error: message.slice(0, 300) }),
          }).catch(() => undefined)
        }
      } finally {
        router.refresh()
      }
    },
    [playlistId, router, update, workspaceId],
  )

  const pump = React.useCallback(() => {
    while (activeRef.current < PARALLEL && queueRef.current.length) {
      const next = queueRef.current.shift()!
      activeRef.current += 1
      void uploadOne(next).finally(() => {
        activeRef.current -= 1
        pump()
      })
    }
  }, [uploadOne])

  const onDrop = React.useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      for (const r of rejections) {
        const reason = r.errors[0]?.code === 'file-too-large' ? `is over ${formatBytes(UPLOAD.maxOriginalBytes)}` : 'is not a supported audio file'
        toast.error(`${r.file.name} ${reason}.`)
      }
      if (!accepted.length) return
      const fresh: UploadItem[] = accepted.map((file) => ({ id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`, file, state: 'queued', progress: 0, error: null }))
      setItems((prev) => [...fresh, ...prev])
      queueRef.current.push(...fresh)
      pump()
    },
    [pump],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: UPLOAD.maxOriginalBytes,
    disabled,
    noClick: true,
    noKeyboard: true,
    multiple: true,
  })

  const busy = items.some((i) => i.state !== 'done' && i.state !== 'error')

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors',
          disabled ? 'cursor-not-allowed border-border bg-surface/40 opacity-60' : 'border-border-strong bg-surface/60',
          isDragActive && !disabled ? 'border-pink bg-pink/5' : '',
        )}
      >
        <input {...getInputProps()} aria-label="Choose audio files" />
        <span className={cn('flex size-11 items-center justify-center rounded-2xl', isDragActive ? 'bg-pink/15 text-pink' : 'bg-surface-2 text-fg-muted')}>
          <CloudUpload className="size-5" aria-hidden />
        </span>
        <p className="text-sm font-medium">{isDragActive ? 'Drop to upload' : 'Drag audio files here'}</p>
        <p className="max-w-md text-xs text-fg-muted [text-wrap:pretty]">
          {disabled && disabledReason
            ? disabledReason
            : `${UPLOAD.acceptedExtensions.join(', ')} up to ${formatBytes(UPLOAD.maxOriginalBytes)} each. Every file is normalized to ${UPLOAD.output.bitrateKbps} kbps Opus; the original is not kept.`}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={open} disabled={disabled} className="mt-1">
          Choose files
        </Button>
      </div>

      {items.length ? (
        <ul className="space-y-1.5" aria-live="polite" aria-busy={busy}>
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <FileMusic className="size-4 shrink-0 text-fg-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{it.file.name}</span>
                  <span className="shrink-0 text-xs text-fg-muted tabular-nums">
                    {it.state === 'queued' && 'Waiting'}
                    {it.state === 'presigning' && 'Starting'}
                    {it.state === 'uploading' && `${it.progress}%`}
                    {it.state === 'finishing' && 'Queuing transcode'}
                    {it.state === 'done' && 'Uploaded'}
                    {it.state === 'error' && 'Failed'}
                  </span>
                </div>
                {it.state === 'error' ? (
                  <p className="mt-0.5 text-xs text-danger [text-wrap:pretty]">{it.error}</p>
                ) : (
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                    <div className={cn('h-full rounded-full transition-[width]', it.state === 'done' ? 'bg-success' : 'bg-pink')} style={{ width: `${it.state === 'done' ? 100 : it.progress}%` }} />
                  </div>
                )}
              </div>
              {it.state === 'done' || it.state === 'error' ? (
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
                  aria-label="Dismiss"
                  className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
