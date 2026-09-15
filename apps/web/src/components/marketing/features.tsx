import {
  ArrowRightLeft,
  Clock,
  FolderOpen,
  Link2,
  Mail,
  PauseCircle,
  Shield,
  UploadCloud,
  UserCheck,
  Users,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { DEFAULT_ROLES, INACTIVITY } from '@ume/shared'
import { Container, Eyebrow, Section, SectionLead, SectionTitle } from '@/components/site/container'
import { Badge } from '@/components/ui/badge'

interface Point {
  icon: LucideIcon
  title: string
  body: string
}

function PointList({ points }: { points: Point[] }) {
  return (
    <ul className="mt-8 flex flex-col gap-5">
      {points.map((p) => (
        <li key={p.title} className="flex gap-4">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-pink/10 text-pink">
            <p.icon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">{p.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{p.body}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function FeatureBlock({
  id,
  eyebrow,
  title,
  lead,
  points,
  visual,
  flip,
}: {
  id: string
  eyebrow: string
  title: string
  lead: string
  points: Point[]
  visual: React.ReactNode
  flip?: boolean
}) {
  return (
    <div id={id} className="scroll-mt-24 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? 'lg:order-2' : undefined}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <SectionTitle>{title}</SectionTitle>
        <SectionLead>{lead}</SectionLead>
        <PointList points={points} />
      </div>
      <div className={flip ? 'lg:order-1' : undefined}>{visual}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ visuals */

function ChannelVisual() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Voice channels</p>
      <ul className="mt-4 flex flex-col gap-1.5 text-sm">
        <li className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
          <span className="flex items-center gap-2">
            <span className="text-fg-subtle">🔊</span> lounge
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
            <span className="text-fg-subtle">🔊</span> late-night
          </span>
          <span className="text-xs text-fg-subtle">empty · Ume would pause here</span>
        </li>
      </ul>
      <div className="mt-5 rounded-xl border border-border bg-bg/60 p-3 text-xs text-fg-muted">
        <span className="font-semibold text-fg">Moved Ume to #late-night?</span> That becomes home. It reconnects there
        after a restart, and it never wanders off on its own.
      </div>
    </div>
  )
}

function LibraryVisual() {
  const rows = [
    { title: 'Plastic Love', artist: 'Mariya Takeuchi', by: 'nadia', via: 'upload', dur: '7:57' },
    { title: 'Midnight Pretenders', artist: 'Tomoko Aran', by: 'theo', via: 'youtube', dur: '5:18' },
    { title: 'Stay With Me', artist: 'Miki Matsubara', by: 'nadia', via: 'upload', dur: '4:16' },
    { title: 'Remember Summer Days', artist: 'Anri', by: 'kip', via: 'upload', dur: '4:52' },
  ]
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-pink/15 text-pink">
            <FolderOpen className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">city-pop</p>
            <p className="text-xs text-fg-subtle">4 tracks · 22 min</p>
          </div>
        </div>
        <Badge tone="sage">Drop files here</Badge>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r, i) => (
          <li key={r.title} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
            <span className="text-xs tabular-nums text-fg-subtle">{i + 1}</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{r.title}</p>
              <p className="truncate text-xs text-fg-muted">
                {r.artist} · added by <span className="text-fg">@{r.by}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-fg-subtle">
              {r.via === 'youtube' ? (
                <Badge tone="default">
                  <Youtube className="size-3" /> linked
                </Badge>
              ) : null}
              <span className="tabular-nums">{r.dur}</span>
            </div>
          </li>
        ))}
      </ul>
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
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Roles</p>
        <span className="text-xs text-fg-subtle">capability bitmasks, not vibes</span>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {DEFAULT_ROLES.map((r) => (
          <li key={r.key} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <Badge tone={tones[r.key] ?? 'default'} className="mt-0.5 shrink-0">
              {r.name}
            </Badge>
            <p className="text-xs leading-relaxed text-fg-muted">{r.description}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg/60 p-3">
          <p className="flex items-center gap-1.5 font-semibold text-fg">
            <ArrowRightLeft className="size-3.5 text-pink" /> Discord role map
          </p>
          <p className="mt-1 text-fg-muted">
            @DJ → Servant, @everyone → Peon. Members get access the moment they sign in.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg/60 p-3">
          <p className="flex items-center gap-1.5 font-semibold text-fg">
            <Clock className="size-3.5 text-pink" /> Everything expires
          </p>
          <p className="mt-1 text-fg-muted">Links, email invites and the memberships they grant all carry an expiry.</p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ section */

export function Features() {
  return (
    <Section id="features" className="scroll-mt-16">
      <Container className="flex flex-col gap-24 sm:gap-32">
        <FeatureBlock
          id="always-on"
          eyebrow="Always on"
          title="It never leaves the channel."
          lead="Ume is not a bot you summon. It is a resident. Add it once, pick a home channel, and it is simply there every time someone walks in."
          points={[
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
              icon: PauseCircle,
              title: 'Pauses when empty',
              body: 'When the last person leaves, playback pauses after a short grace period and picks up where it left off when someone returns.',
            },
          ]}
          visual={<ChannelVisual />}
        />

        <FeatureBlock
          id="your-library"
          eyebrow="Your library"
          title="A library your whole server builds."
          lead="Music lives in flat, named playlists. No nesting, no folder archaeology. Every track remembers who brought it in."
          flip
          points={[
            {
              icon: UploadCloud,
              title: 'Drag-and-drop uploads',
              body: 'Drop MP3, FLAC, WAV, M4A or OGG into a playlist. Ume normalizes loudness and stores Opus so playback needs zero transcoding.',
            },
            {
              icon: UserCheck,
              title: 'Who added what',
              body: 'Every track shows the member who added it and when, so a great playlist gets credit and a bad one gets a conversation.',
            },
            {
              icon: Youtube,
              title: 'YouTube links',
              body: 'Paste a link and Ume keeps a linked entry with the title, artist and cover. Ume is not a converter; links stay links.',
            },
          ]}
          visual={<LibraryVisual />}
        />

        <FeatureBlock
          id="your-rules"
          eyebrow="Your rules"
          title="Real permissions, not a free-for-all."
          lead="Four roles, mapped straight onto your Discord roles if you like. Hand out contributor access with a link; hand out real power only by name."
          points={[
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
          ]}
          visual={<RolesVisual />}
        />
      </Container>
      <p className="sr-only">Free workspaces idle for {INACTIVITY.purgeAfterDays} days are removed after notice.</p>
    </Section>
  )
}
