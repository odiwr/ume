import {
  ArrowRightLeft,
  CirclePause,
  Clock,
  CloudUpload,
  FolderOpen,
  Link2,
  Mail,
  Shield,
  UserCheck,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import { DEFAULT_ROLES, INACTIVITY, SUPPORTED_LINK_SITES, UPLOAD, linkSiteLabel } from '@ume/shared'
import { Container, Section, SectionLead, SectionTitle } from '@/components/site/container'
import { Badge } from '@/components/ui/badge'

interface Point {
  icon: LucideIcon
  title: string
  body: string
}

function PointList({ points, className }: { points: Point[]; className?: string }) {
  return (
    <ul className={className ?? 'mt-8 flex flex-col gap-5'}>
      {points.map((p) => (
        <li key={p.title} className="flex gap-4">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-pink/10 text-pink">
            <p.icon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">{p.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted [text-wrap:pretty]">
              {p.body}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Headline with the section's two-word identity set in pink, instead of a repeated eyebrow label. */
function Headline({ lead, rest }: { lead: string; rest: string }) {
  return (
    <SectionTitle className="[text-wrap:balance]">
      <span className="text-pink">{lead}</span> {rest}
    </SectionTitle>
  )
}

/* ------------------------------------------------------------------ visuals */

function ChannelVisual() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
        Voice channels
      </p>
      <ul className="mt-4 flex flex-col gap-1.5 text-sm">
        <li className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
          <span className="flex items-center gap-2">
            <Volume2 className="size-4 text-fg-subtle" aria-hidden /> lounge
          </span>
          <Badge tone="pink">
            <span className="size-1.5 rounded-full bg-pink" /> Ume live
          </Badge>
        </li>
        <li className="ml-6 flex items-center gap-2 rounded-lg px-3 py-1.5 text-fg-muted">
          <span className="size-5 rounded-full bg-pink/80" /> Ume
          <span className="ml-auto text-xs text-fg-subtle">playing · city-pop</span>
        </li>
        <li className="ml-6 flex items-center gap-2 rounded-lg px-3 py-1.5 text-fg-muted">
          <span className="size-5 rounded-full bg-sage/70" /> nadia
        </li>
        <li className="ml-6 flex items-center gap-2 rounded-lg px-3 py-1.5 text-fg-muted">
          <span className="size-5 rounded-full bg-beige/70" /> theo
        </li>
        <li className="mt-2 flex items-center justify-between rounded-xl px-3 py-2.5 text-fg-muted">
          <span className="flex items-center gap-2">
            <Volume2 className="size-4 text-fg-subtle" aria-hidden /> late-night
          </span>
          <span className="text-xs text-fg-subtle">empty · Ume would pause here</span>
        </li>
      </ul>
      <div className="mt-5 rounded-xl border border-border bg-bg/60 p-3 text-xs text-fg-muted [text-wrap:pretty]">
        <span className="font-semibold text-fg">Moved Ume to #late-night?</span> That becomes home.
        It reconnects there after a restart, and it never wanders off on its own.
      </div>
    </div>
  )
}

const LIBRARY_ROWS = [
  { title: 'Plastic Love', artist: 'Mariya Takeuchi', by: 'nadia', site: null, dur: '7:57' },
  { title: 'Midnight Pretenders', artist: 'Tomoko Aran', by: 'theo', site: 'youtube', dur: '5:18' },
  { title: 'Stay With Me', artist: 'Miki Matsubara', by: 'nadia', site: null, dur: '4:16' },
  { title: 'Remember Summer Days', artist: 'Anri', by: 'kip', site: 'bandcamp', dur: '4:52' },
  {
    title: 'Telephone Number',
    artist: 'Junko Ohashi',
    by: 'theo',
    site: 'soundcloud',
    dur: '4:40',
  },
] as const

function LibraryVisual() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pink/15 text-pink">
              <FolderOpen className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">city-pop</p>
              <p className="text-xs text-fg-subtle">5 tracks · 27 min</p>
            </div>
          </div>
          <Badge tone="sage" className="shrink-0">
            <CloudUpload className="size-3" aria-hidden /> Drop files here
          </Badge>
        </div>
        <ul className="divide-y divide-border">
          {LIBRARY_ROWS.map((r, i) => (
            <li
              key={r.title}
              className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm sm:px-5"
            >
              <span className="text-xs tabular-nums text-fg-subtle">{i + 1}</span>
              <div className="min-w-0">
                <p className="truncate font-medium">{r.title}</p>
                <p className="truncate text-xs text-fg-muted">
                  {r.artist} · added by <span className="text-fg">@{r.by}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-fg-subtle">
                {r.site ? (
                  <Badge tone="default" className="hidden sm:inline-flex">
                    <Link2 className="size-3" aria-hidden /> {linkSiteLabel(r.site)}
                  </Badge>
                ) : null}
                <span className="tabular-nums">{r.dur}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
            Add a song from a link
          </p>
          <div className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-border bg-bg/60 px-3 text-sm text-fg-subtle">
            <Link2 className="size-4 shrink-0" aria-hidden />
            <span className="truncate">https://soundcloud.com/artist/track</span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {SUPPORTED_LINK_SITES.map((s) => (
              <li
                key={s.site}
                className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-fg-muted"
              >
                {s.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-fg-muted [text-wrap:pretty]">
            Ume fetches the audio, fills in the title, artist and cover, and stores it next to your
            uploads so the playlist reads as one list.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-fg-muted sm:p-5 [text-wrap:pretty]">
          <p className="font-semibold text-fg">
            Every file becomes {UPLOAD.output.bitrateKbps} kbps Opus.
          </p>
          <p className="mt-1">
            Loudness is normalized so tracks sit at the same level, and Discord voice already speaks
            Opus, so playback never transcodes.
          </p>
        </div>
      </div>
    </div>
  )
}

function RolesVisual() {
  const tones: Record<string, 'pink' | 'sage' | 'beige' | 'default'> = {
    owner: 'pink',
    master: 'sage',
    servant: 'beige',
    peon: 'default',
  }
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Roles</p>
        <span className="text-xs text-fg-subtle">capability bitmasks, not vibes</span>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {DEFAULT_ROLES.map((r) => (
          <li key={r.key} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <Badge tone={tones[r.key] ?? 'default'} className="mt-0.5 shrink-0">
              {r.name}
            </Badge>
            <p className="text-xs leading-relaxed text-fg-muted [text-wrap:pretty]">
              {r.description}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg/60 p-3">
          <p className="flex items-center gap-1.5 font-semibold text-fg">
            <ArrowRightLeft className="size-3.5 text-pink" aria-hidden /> Discord role map
          </p>
          <p className="mt-1 text-fg-muted [text-wrap:pretty]">
            @DJ to Servant, @everyone to Peon. Members get access the moment they sign in.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg/60 p-3">
          <p className="flex items-center gap-1.5 font-semibold text-fg">
            <Clock className="size-3.5 text-pink" aria-hidden /> Everything expires
          </p>
          <p className="mt-1 text-fg-muted [text-wrap:pretty]">
            Links, email invites and the memberships they grant all carry an expiry.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ section */

const ALWAYS_ON: Point[] = [
  {
    icon: Shield,
    title: 'Never leaves',
    body: 'Ume stays connected around the clock. No idle timeouts, no "the bot left" moments in the middle of a session.',
  },
  {
    icon: ArrowRightLeft,
    title: 'Follows when moved',
    body: 'Drag Ume into another voice channel and that channel becomes its new home. It reconnects there after every restart.',
  },
  {
    icon: CirclePause,
    title: 'Pauses when empty',
    body: 'When the last person leaves, playback pauses after a short grace period and picks up where it left off when someone returns.',
  },
]

const YOUR_LIBRARY: Point[] = [
  {
    icon: CloudUpload,
    title: 'Drag-and-drop uploads',
    body: `Drop ${UPLOAD.acceptedExtensions
      .slice(0, 5)
      .map((e) => e.toUpperCase())
      .join(
        ', ',
      )} or other audio into a playlist. Ume transcodes it once and deletes the original.`,
  },
  {
    icon: Link2,
    title: 'Add a song from a link',
    body: 'Paste a link from YouTube, SoundCloud, Bandcamp, Audius and more. Ume extracts the audio and files it in the playlist you named.',
  },
  {
    icon: UserCheck,
    title: 'Who added what',
    body: 'Every track shows the member who added it and when, so a great playlist gets credit and a bad one gets a conversation.',
  },
]

const YOUR_RULES: Point[] = [
  {
    icon: Users,
    title: 'Owner, Master, Servant, Peon',
    body: 'Owner runs billing and the danger zone. Master edits everything and manages people. Servant adds music. Peon listens and browses.',
  },
  {
    icon: Link2,
    title: 'Share links',
    body: 'Links grant up to Servant-level access, require Discord server membership by default, and expire when you say so.',
  },
  {
    icon: Mail,
    title: 'Email invites',
    body: 'Master access is only ever granted by an invite bound to an email address, so a leaked link can never delete your library.',
  },
]

export function Features() {
  return (
    <Section id="features" className="scroll-mt-16">
      <Container className="flex flex-col gap-24 sm:gap-32">
        {/* 1. Split: copy left, channel mock right */}
        <div
          id="always-on"
          className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16"
        >
          <div>
            <Headline lead="Always on." rest="It never leaves the channel." />
            <SectionLead className="[text-wrap:pretty]">
              Ume is not a bot you summon. It is a resident. Add it once, pick a home channel, and
              it is simply there every time someone walks in.
            </SectionLead>
            <PointList points={ALWAYS_ON} />
          </div>
          <ChannelVisual />
        </div>

        {/* 2. Full width: the library is the product, so it gets the whole row */}
        <div id="your-library" className="scroll-mt-24">
          <div className="max-w-2xl">
            <Headline lead="Your library." rest="Built by the whole server." />
            <SectionLead className="[text-wrap:pretty]">
              Music lives in flat, named playlists. No nesting, no folder archaeology. Every track
              remembers who brought it in and where it came from.
            </SectionLead>
          </div>
          <div className="mt-10">
            <LibraryVisual />
          </div>
          <PointList points={YOUR_LIBRARY} className="mt-10 grid gap-6 md:grid-cols-3" />
        </div>

        {/* 3. Split, mirrored: roles mock left, copy right */}
        <div
          id="your-rules"
          className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16"
        >
          <div className="lg:order-2">
            <Headline lead="Your rules." rest="Real permissions, not a free-for-all." />
            <SectionLead className="[text-wrap:pretty]">
              Four roles, mapped straight onto your Discord roles if you like. Hand out contributor
              access with a link; hand out real power only by name.
            </SectionLead>
            <PointList points={YOUR_RULES} />
          </div>
          <div className="lg:order-1">
            <RolesVisual />
          </div>
        </div>
      </Container>
      <p className="sr-only">
        Free workspaces idle for {INACTIVITY.purgeAfterDays} days are removed after notice.
      </p>
    </Section>
  )
}
