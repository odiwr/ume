import {
  ArrowUpRight,
  HeadphonesFilled,
  Link2,
  Crown,
  ShieldCheck,
  Plus,
  Upload,
  Volume2,
} from '@/components/ui/icons'
import Link from 'next/link'
import { DEFAULT_ROLES } from '@ume/shared'
import { AlbumCover } from './album-cover'
import { MusicSpectrum } from './music-spectrum'
import { Container, Section, SectionLead, SectionTitle } from '@/components/site/container'

export function Features() {
  return (
    <Section id="features" className="scroll-mt-20">
      <Container>
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <SectionTitle>
              One shared library.
              <br />
              Always in your channel.
            </SectionTitle>
          </div>
          <SectionLead className="max-w-sm">
            Keep your playlists in one place and choose who can add music or manage the library.
          </SectionLead>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <article
            id="always-on"
            className="flex flex-col overflow-hidden rounded-3xl bg-sage-light"
          >
            <div className="p-7 sm:p-10">
              <h3 className="font-display text-3xl font-medium sm:text-4xl">
                Connected around the clock.
              </h3>
              <p className="mt-4 max-w-md text-fg-muted">
                Ume stays in your voice channel, pauses when the room is empty, and picks up when
                someone returns. Move it to a new channel and it makes itself at home.
              </p>
            </div>
            <div
              className="mx-7 mb-7 mt-auto overflow-hidden rounded-2xl bg-fg p-5 text-white sm:mx-10 sm:mb-10 sm:p-6"
              aria-label="Ume playing in lounge, sample visualization"
            >
              <div className="flex items-center justify-end gap-2 text-sm font-medium">
                #Lounge <Volume2 className="size-4" aria-hidden />
              </div>
              <MusicSpectrum />
              <div className="mt-5 flex items-center gap-3">
                <AlbumCover index={3} className="size-11" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Night drive</p>
                  <p className="text-xs text-white/65">Low Season</p>
                </div>
              </div>
            </div>
          </article>
          <article
            id="your-library"
            className="flex flex-col overflow-hidden rounded-3xl bg-surface-2"
          >
            <div className="p-7 sm:p-10">
              <h3 className="font-display text-3xl font-medium sm:text-4xl">
                Build playlists together.
              </h3>
              <p className="mt-4 max-w-md text-fg-muted">
                Drop in your own audio or add a song from a link. Keep everything in playlists, with
                the name of the member who added each track.
              </p>
            </div>
            <div className="mx-7 mb-7 mt-auto flex flex-col gap-3 sm:mx-10 sm:mb-10">
              <div className="flex items-center gap-4 rounded-2xl bg-surface/70 p-5">
                <Upload className="size-5 shrink-0 text-sage" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Bring your own music</p>
                  <p className="text-xs text-fg-muted">Upload audio files to a playlist.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl bg-surface/70 p-5">
                <Link2 className="size-5 shrink-0 text-pink" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Add a song from a link</p>
                  <p className="text-xs text-fg-muted">
                    Add a link to audio you have rights to use.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
        <article
          id="your-rules"
          className="mt-5 grid items-center gap-8 rounded-3xl bg-blush p-7 sm:p-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16"
        >
          <div>
            <h3 className="font-display text-3xl font-medium sm:text-4xl">
              Choose who can do what.
            </h3>
            <p className="mt-4 max-w-lg text-fg-muted">
              Let friends add tracks, give your DJs control, and keep the important settings in
              trusted hands. Connect existing Discord roles or invite people yourself.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline decoration-fg/30 underline-offset-4"
            >
              Set up your server <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="" aria-label="Example role permissions">
            {DEFAULT_ROLES.map((role, i) => {
              const Marker = [Crown, ShieldCheck, Plus, HeadphonesFilled][i]!
              const descriptions = [
                'Settings, billing, and full access.',
                'Manage music and members.',
                'Add music to playlists.',
                'Browse and control playback.',
              ]
              const tones = [
                'bg-pink/15 text-pink',
                'bg-sage/15 text-sage',
                'bg-success/15 text-success',
                'bg-white/65 text-fg-muted',
              ]
              return (
                <div key={role.key} className="flex items-center gap-4 py-3">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tones[i]}`}
                  >
                    <Marker className="size-4" />
                  </span>
                  <div className="flex flex-1 flex-col justify-between gap-1 sm:flex-row sm:gap-4">
                    <p className="text-sm font-semibold">{role.name}</p>
                    <p className="text-sm text-fg-muted">{descriptions[i]}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      </Container>
    </Section>
  )
}
