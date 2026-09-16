'use client'

import { useState } from 'react'
import { SlidersHorizontal, HeadphonesFilled, Volume2 } from '@/components/ui/icons'
import { Logo } from '@/components/ui/logo'
import { AlbumCover } from './album-cover'

const PLAYLISTS = [
  {
    name: 'Slow mornings',
    mood: 'A sample playlist for the morning.',
    cover: 0,
    tracks: [
      { title: 'First light', artist: 'Sunday Service', by: 'nadia', time: '3:42' },
      { title: 'Window seat', artist: 'Soft Focus', by: 'theo', time: '4:18' },
      { title: 'No rush', artist: 'The Daydreams', by: 'kip', time: '2:56' },
    ],
  },
  {
    name: 'After hours',
    mood: 'A sample evening playlist.',
    cover: 3,
    tracks: [
      { title: 'Night drive', artist: 'Low Season', by: 'theo', time: '4:06' },
      { title: 'Somewhere, still', artist: 'Paper Moon', by: 'nadia', time: '3:28' },
      { title: 'Last train home', artist: 'Soft Focus', by: 'kip', time: '5:12' },
    ],
  },
]

export function LibraryPreview() {
  const [selected, setSelected] = useState(0)
  const playlist = PLAYLISTS[selected]!
  return (
    <div
      className="mx-auto w-full max-w-5xl rounded-t-3xl bg-surface p-2 text-left shadow-[0_20px_70px_-30px_rgb(37_43_38/0.25)] sm:p-3"
      aria-label="Sample music library"
    >
      <div className="grid overflow-hidden rounded-t-2xl sm:grid-cols-[180px_1fr] lg:grid-cols-[210px_1fr]">
        <aside
          className="flex min-w-0 flex-col bg-surface-2 p-4 lg:p-5"
          aria-label="Preview server"
        >
          <Logo size={26} />
          <div className="mt-7 flex items-center gap-3 px-2 pb-3">
            <HeadphonesFilled className="size-5 shrink-0 text-sage" />
            <p className="text-sm font-semibold">Moonwave</p>
          </div>
          <nav className="mt-2 flex flex-col gap-2" aria-label="Preview playlists">
            {PLAYLISTS.map((item, i) => (
              <button
                key={item.name}
                type="button"
                aria-pressed={i === selected}
                onClick={() => setSelected(i)}
                className={`flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors ${i === selected ? 'bg-surface text-fg font-medium' : 'text-fg-muted hover:bg-surface/70'}`}
              >
                <AlbumCover index={item.cover} className="size-9 rounded-md" />
                <span>{item.name}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-2 pt-8 text-xs text-fg-muted">
            <Volume2 className="size-4" /> #Lounge
          </div>
        </aside>
        <div className="min-w-0 p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <p className="text-lg font-medium">Music library</p>
            <span
              role="img"
              aria-label="Nadia’s profile"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-light text-sm text-sage"
            >
              N
            </span>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-surface-2/65 p-4 sm:gap-5 sm:p-5">
            <AlbumCover index={playlist.cover} className="size-20 sm:size-28 lg:size-32" />
            <div className="min-w-0">
              <p className="font-display text-2xl font-medium leading-tight lg:text-3xl">
                {playlist.name}
              </p>
              <p className="mt-2 text-xs text-fg-muted">3 tracks</p>
              <div className="mt-4 hidden flex-wrap items-center gap-2 text-xs text-fg-muted sm:flex">
                <span className="flex gap-1" aria-hidden>
                  {['N', 'T', 'K'].map((name, i) => (
                    <span
                      key={name}
                      className={`flex size-6 items-center justify-center rounded-full ${i === 1 ? 'bg-blush' : 'bg-sage-light'}`}
                    >
                      {name}
                    </span>
                  ))}
                </span>
                <span>Music added by members.</span>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 text-xs text-fg-muted">
            <span className="sm:invisible">Music added by members.</span>
            <span
              aria-label="Sample filter control"
              className="inline-flex min-h-11 items-center gap-2 text-sm"
            >
              <SlidersHorizontal className="size-4" /> Filter
            </span>
          </div>
          <div aria-live="polite" aria-atomic="true">
            <p className="sr-only">
              {playlist.name}. {playlist.mood}
            </p>
            <ul className="space-y-1">
              {playlist.tracks.map((track, i) => (
                <li key={track.title} className="flex items-center gap-3 rounded-xl py-3 text-sm">
                  <span className="w-4 shrink-0 text-xs text-fg-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <AlbumCover index={playlist.cover + i} className="size-10 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{track.title}</p>
                    <p className="truncate text-xs text-fg-muted">{track.artist}</p>
                  </div>
                  <span className="hidden text-xs text-fg-muted xl:block">
                    added by @{track.by}
                  </span>
                  <span className="text-xs tabular-nums text-fg-muted">{track.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
