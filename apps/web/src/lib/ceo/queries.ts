import 'server-only'
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import { format, startOfWeek, subWeeks } from 'date-fns'
import { PLANS, getPlan, type PlanId } from '@ume/shared'
import {
  db,
  accounts,
  activityEvents,
  auditLogs,
  blockedHashes,
  playlists,
  dmcaNotices,
  effectiveQuotaBytes,
  invites,
  memberships,
  notifications,
  roles,
  tracks,
  users,
  workspaces,
  type DmcaNotice,
  type Workspace,
  type WorkspaceStatus,
} from '@/lib/db'

/** A bot is "online" when it reported within three heartbeats (30 s each). */
export const BOT_ONLINE_WINDOW_MS = 90_000

export const WORKSPACE_STATUSES: readonly WorkspaceStatus[] = [
  'unclaimed',
  'connected',
  'disconnected',
  'purging',
  'purged',
]
export const DMCA_STATUSES = [
  'received',
  'actioned',
  'counter_noticed',
  'restored',
  'rejected',
] as const
export type DmcaStatus = (typeof DMCA_STATUSES)[number]

export const DEFAULT_PAGE_SIZE = 25

function pattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0)
}

export function clampPage(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

export function str(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw
  return (v ?? '').trim()
}

// ────────────────────────────────────────────────────────────────────────────
// Overview
// ────────────────────────────────────────────────────────────────────────────

export interface Overview {
  workspaces: {
    total: number
    connected: number
    active7d: number
    purging: number
    botOnline: number
  }
  users: { total: number; withDiscord: number; banned: number }
  tracks: { ready: number; inFlight: number; failed: number; disabled: number }
  storageUsedBytes: number
  mrrUsd: number
  paidWorkspaces: number
  jobs: { available: boolean; byState: Array<{ state: string; count: number }>; failed: number }
  weekly: Array<{ week: string; label: string; count: number }>
  storageByPlan: Array<{ plan: PlanId; workspaces: number; bytes: number }>
}

export async function getOverview(): Promise<Overview> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000)
  const onlineCutoff = new Date(now.getTime() - BOT_ONLINE_WINDOW_MS)

  const [wsAgg, userAgg, trackAgg, paidRows, weeklyRows, planRows, jobs] = await Promise.all([
    db
      .select({
        total: count(),
        connected: sql<number>`count(*) filter (where ${workspaces.status} = 'connected')::int`,
        active7d: sql<number>`count(*) filter (where ${workspaces.lastActivityAt} > ${sevenDaysAgo} and ${workspaces.status} = 'connected')::int`,
        purging: sql<number>`count(*) filter (where ${workspaces.status} = 'purging')::int`,
        botOnline: sql<number>`count(*) filter (where ${workspaces.botConnected} and ${workspaces.botLastSeenAt} > ${onlineCutoff})::int`,
        storageUsed: sql<string>`coalesce(sum(${workspaces.storageUsedBytes}), 0)::bigint`,
      })
      .from(workspaces)
      .then((r) => r[0]),
    db
      .select({
        total: count(),
        withDiscord: sql<number>`count(*) filter (where ${users.discordUserId} is not null)::int`,
        banned: sql<number>`count(*) filter (where ${users.banned})::int`,
      })
      .from(users)
      .then((r) => r[0]),
    db
      .select({
        ready: sql<number>`count(*) filter (where ${tracks.status} = 'ready')::int`,
        inFlight: sql<number>`count(*) filter (where ${tracks.status} in ('pending', 'processing'))::int`,
        failed: sql<number>`count(*) filter (where ${tracks.status} = 'failed')::int`,
        disabled: sql<number>`count(*) filter (where ${tracks.status} = 'disabled')::int`,
      })
      .from(tracks)
      .then((r) => r[0]),
    db
      .select({ plan: workspaces.plan, n: count() })
      .from(workspaces)
      .where(
        and(
          ne(workspaces.plan, 'free'),
          inArray(workspaces.stripeSubscriptionStatus, ['active', 'trialing']),
        ),
      )
      .groupBy(workspaces.plan),
    db.execute<{ week: string; count: number }>(
      sql`select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as week, count(*)::int as count
          from workspaces
          where created_at > now() - interval '12 weeks'
          group by 1 order by 1`,
    ),
    db
      .select({
        plan: workspaces.plan,
        n: count(),
        bytes: sql<string>`coalesce(sum(${workspaces.storageUsedBytes}), 0)::bigint`,
      })
      .from(workspaces)
      .where(ne(workspaces.status, 'purged'))
      .groupBy(workspaces.plan),
    getJobStates(),
  ])

  // Fill every one of the last 12 ISO weeks so the chart has no gaps.
  const weekCounts = new Map<string, number>()
  for (const row of weeklyRows) weekCounts.set(String(row.week), num(row.count))
  const weekly: Overview['weekly'] = []
  const thisWeek = startOfWeek(now, { weekStartsOn: 1 })
  for (let i = 11; i >= 0; i--) {
    const d = subWeeks(thisWeek, i)
    const key = format(d, 'yyyy-MM-dd')
    weekly.push({ week: key, label: format(d, 'd MMM'), count: weekCounts.get(key) ?? 0 })
  }

  const planBytes = new Map(planRows.map((r) => [r.plan, { n: num(r.n), bytes: num(r.bytes) }]))
  const storageByPlan = PLANS.map((p) => ({
    plan: p.id,
    workspaces: planBytes.get(p.id)?.n ?? 0,
    bytes: planBytes.get(p.id)?.bytes ?? 0,
  }))

  let mrrUsd = 0
  let paidWorkspaces = 0
  for (const r of paidRows) {
    mrrUsd += getPlan(r.plan).priceUsdMonthly * num(r.n)
    paidWorkspaces += num(r.n)
  }

  return {
    workspaces: {
      total: num(wsAgg?.total),
      connected: num(wsAgg?.connected),
      active7d: num(wsAgg?.active7d),
      purging: num(wsAgg?.purging),
      botOnline: num(wsAgg?.botOnline),
    },
    users: {
      total: num(userAgg?.total),
      withDiscord: num(userAgg?.withDiscord),
      banned: num(userAgg?.banned),
    },
    tracks: {
      ready: num(trackAgg?.ready),
      inFlight: num(trackAgg?.inFlight),
      failed: num(trackAgg?.failed),
      disabled: num(trackAgg?.disabled),
    },
    storageUsedBytes: num(wsAgg?.storageUsed),
    mrrUsd,
    paidWorkspaces,
    jobs,
    weekly,
    storageByPlan,
  }
}

/** Best-effort read of the pg-boss job table; the schema does not exist until the worker has run once. */
export async function getJobStates(): Promise<Overview['jobs']> {
  try {
    const rows = await db.execute<{ state: string; count: number }>(
      sql`select state::text as state, count(*)::int as count from pgboss.job group by state order by state`,
    )
    const byState = Array.from(rows).map((r) => ({ state: String(r.state), count: num(r.count) }))
    return {
      available: true,
      byState,
      failed: byState.find((s) => s.state === 'failed')?.count ?? 0,
    }
  } catch {
    return { available: false, byState: [], failed: 0 }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Workspaces
// ────────────────────────────────────────────────────────────────────────────

export interface WorkspaceRow {
  ws: Workspace
  ownerEmail: string | null
}

export interface Paged<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

export async function listWorkspaces(opts: {
  q?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<Paged<WorkspaceRow>> {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE
  const q = opts.q?.trim() ?? ''
  const status = WORKSPACE_STATUSES.find((s) => s === opts.status)
  const where = and(
    q
      ? or(
          ilike(workspaces.guildName, pattern(q)),
          ilike(workspaces.umeId, pattern(q)),
          eq(workspaces.guildId, q),
          eq(workspaces.id, q),
          ilike(users.email, pattern(q)),
        )
      : undefined,
    status ? eq(workspaces.status, status) : undefined,
  )
  const [rows, totalRow] = await Promise.all([
    db
      .select({ ws: workspaces, ownerEmail: users.email })
      .from(workspaces)
      .leftJoin(users, eq(users.id, workspaces.ownerUserId))
      .where(where)
      .orderBy(desc(workspaces.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(workspaces)
      .leftJoin(users, eq(users.id, workspaces.ownerUserId))
      .where(where)
      .then((r) => r[0]),
  ])
  return { rows, total: num(totalRow?.total), page, pageSize }
}

export async function getWorkspaceDetail(id: string) {
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, id),
    with: { owner: { columns: { id: true, name: true, email: true, discordUsername: true } } },
  })
  if (!ws) return null
  const now = new Date()
  const [members, playlistRows, audit, activity, notes, roleRows, inviteAgg, trackAgg, dmca] =
    await Promise.all([
      db.query.memberships.findMany({
        where: eq(memberships.workspaceId, id),
        with: {
          user: {
            columns: { id: true, name: true, email: true, discordUsername: true, banned: true },
          },
          role: {
            columns: { id: true, name: true, systemKey: true, color: true, capabilities: true },
          },
        },
        orderBy: [asc(memberships.createdAt)],
      }),
      db.query.playlists.findMany({
        where: eq(playlists.workspaceId, id),
        orderBy: [asc(playlists.position), asc(playlists.createdAt)],
      }),
      db.query.auditLogs.findMany({
        where: eq(auditLogs.workspaceId, id),
        with: { actor: { columns: { id: true, email: true, name: true } } },
        orderBy: [desc(auditLogs.createdAt)],
        limit: 25,
      }),
      db.query.activityEvents.findMany({
        where: eq(activityEvents.workspaceId, id),
        orderBy: [desc(activityEvents.createdAt)],
        limit: 25,
      }),
      db.query.notifications.findMany({
        where: eq(notifications.workspaceId, id),
        orderBy: [desc(notifications.createdAt)],
        limit: 25,
      }),
      db.query.roles.findMany({ where: eq(roles.workspaceId, id), orderBy: [asc(roles.position)] }),
      db
        .select({
          active: sql<number>`count(*) filter (where ${invites.revokedAt} is null and ${invites.expiresAt} > ${now})::int`,
          total: count(),
        })
        .from(invites)
        .where(eq(invites.workspaceId, id))
        .then((r) => r[0]),
      db
        .select({
          status: tracks.status,
          n: count(),
          bytes: sql<string>`coalesce(sum(${tracks.sizeBytes}), 0)::bigint`,
        })
        .from(tracks)
        .where(eq(tracks.workspaceId, id))
        .groupBy(tracks.status),
      db.query.dmcaNotices.findMany({
        where: eq(dmcaNotices.workspaceId, id),
        orderBy: [desc(dmcaNotices.createdAt)],
        limit: 10,
      }),
    ])
  return {
    ws,
    quotaBytes: effectiveQuotaBytes(ws),
    members,
    playlists: playlistRows,
    audit,
    activity,
    notifications: notes,
    roles: roleRows,
    invites: { active: num(inviteAgg?.active), total: num(inviteAgg?.total) },
    tracksByStatus: trackAgg.map((t) => ({
      status: t.status,
      count: num(t.n),
      bytes: num(t.bytes),
    })),
    dmca,
  }
}

export type WorkspaceDetail = NonNullable<Awaited<ReturnType<typeof getWorkspaceDetail>>>

// ────────────────────────────────────────────────────────────────────────────
// Users
// ────────────────────────────────────────────────────────────────────────────

export async function listUsers(opts: {
  q?: string
  page?: number
  pageSize?: number
  banned?: boolean
}) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE
  const q = opts.q?.trim() ?? ''
  const where = and(
    q
      ? or(
          ilike(users.email, pattern(q)),
          ilike(users.name, pattern(q)),
          ilike(users.discordUsername, pattern(q)),
          eq(users.discordUserId, q),
          eq(users.id, q),
        )
      : undefined,
    opts.banned ? eq(users.banned, true) : undefined,
  )
  const membershipCount = sql<number>`(select count(*) from ${memberships} m where m.user_id = ${users.id})::int`
  const ownedCount = sql<number>`(select count(*) from ${workspaces} w where w.owner_user_id = ${users.id})::int`
  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        discordUserId: users.discordUserId,
        discordUsername: users.discordUsername,
        banned: users.banned,
        banReason: users.banReason,
        createdAt: users.createdAt,
        memberships: membershipCount,
        owned: ownedCount,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(users)
      .where(where)
      .then((r) => r[0]),
  ])
  return {
    rows: rows.map((r) => ({ ...r, memberships: num(r.memberships), owned: num(r.owned) })),
    total: num(totalRow?.total),
    page,
    pageSize,
  }
}

export async function getUserDetail(id: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!user) return null
  const [memberRows, owned, providers, recentAudit] = await Promise.all([
    db.query.memberships.findMany({
      where: eq(memberships.userId, id),
      with: {
        workspace: {
          columns: { id: true, umeId: true, guildName: true, status: true, plan: true },
        },
        role: { columns: { id: true, name: true, systemKey: true, color: true } },
      },
      orderBy: [desc(memberships.createdAt)],
    }),
    db.query.workspaces.findMany({
      where: eq(workspaces.ownerUserId, id),
      columns: {
        id: true,
        umeId: true,
        guildName: true,
        status: true,
        plan: true,
        storageUsedBytes: true,
        createdAt: true,
      },
      orderBy: [desc(workspaces.createdAt)],
    }),
    db.query.accounts.findMany({
      where: eq(accounts.userId, id),
      columns: { providerId: true, createdAt: true },
    }),
    db.query.auditLogs.findMany({
      where: eq(auditLogs.actorUserId, id),
      with: { workspace: { columns: { id: true, guildName: true } } },
      orderBy: [desc(auditLogs.createdAt)],
      limit: 20,
    }),
  ])
  return { user, memberships: memberRows, owned, providers, recentAudit }
}

// ────────────────────────────────────────────────────────────────────────────
// Storage
// ────────────────────────────────────────────────────────────────────────────

export async function getStorageReport() {
  const [top, byStatus, byPlan, blocked] = await Promise.all([
    db
      .select({
        id: workspaces.id,
        umeId: workspaces.umeId,
        guildName: workspaces.guildName,
        status: workspaces.status,
        plan: workspaces.plan,
        storageUsedBytes: workspaces.storageUsedBytes,
        storageQuotaOverrideBytes: workspaces.storageQuotaOverrideBytes,
        trackCount: workspaces.trackCount,
      })
      .from(workspaces)
      .where(ne(workspaces.status, 'purged'))
      .orderBy(desc(workspaces.storageUsedBytes))
      .limit(30),
    db
      .select({
        status: tracks.status,
        n: count(),
        bytes: sql<string>`coalesce(sum(${tracks.sizeBytes}), 0)::bigint`,
      })
      .from(tracks)
      .groupBy(tracks.status),
    db
      .select({
        plan: workspaces.plan,
        n: count(),
        bytes: sql<string>`coalesce(sum(${workspaces.storageUsedBytes}), 0)::bigint`,
        tracks: sql<number>`coalesce(sum(${workspaces.trackCount}), 0)::int`,
      })
      .from(workspaces)
      .where(ne(workspaces.status, 'purged'))
      .groupBy(workspaces.plan),
    db
      .select({ n: count() })
      .from(blockedHashes)
      .then((r) => r[0]),
  ])
  const planMap = new Map(byPlan.map((p) => [p.plan, p]))
  return {
    top: top.map((w) => ({
      ...w,
      storageUsedBytes: num(w.storageUsedBytes),
      quotaBytes: effectiveQuotaBytes(w),
    })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: num(s.n), bytes: num(s.bytes) })),
    byPlan: PLANS.map((p) => {
      const row = planMap.get(p.id)
      const n = num(row?.n)
      return {
        plan: p.id,
        name: p.name,
        workspaces: n,
        bytes: num(row?.bytes),
        tracks: num(row?.tracks),
        quotaBytes: n * p.storageBytes,
      }
    }),
    blockedHashes: num(blocked?.n),
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Revenue
// ────────────────────────────────────────────────────────────────────────────

export async function getRevenueReport() {
  const rows = await db
    .select({ ws: workspaces, ownerEmail: users.email })
    .from(workspaces)
    .leftJoin(users, eq(users.id, workspaces.ownerUserId))
    .where(
      or(
        ne(workspaces.plan, 'free'),
        isNotNull(workspaces.stripeSubscriptionId),
        isNotNull(workspaces.stripeCustomerId),
      ),
    )
    .orderBy(desc(workspaces.planRenewsAt), desc(workspaces.createdAt))
    .limit(200)
  const mrrByPlan = PLANS.filter((p) => p.priceUsdMonthly > 0).map((p) => {
    const active = rows.filter(
      (r) =>
        r.ws.plan === p.id &&
        (r.ws.stripeSubscriptionStatus === 'active' ||
          r.ws.stripeSubscriptionStatus === 'trialing'),
    ).length
    return { plan: p.id, name: p.name, active, mrrUsd: active * p.priceUsdMonthly }
  })
  const mrrUsd = mrrByPlan.reduce((a, b) => a + b.mrrUsd, 0)
  return { rows, mrrByPlan, mrrUsd }
}

// ────────────────────────────────────────────────────────────────────────────
// Bot health
// ────────────────────────────────────────────────────────────────────────────

export type BotHealth = 'online' | 'stale' | 'offline' | 'not_in_guild'

export function classifyBot(
  ws: Pick<Workspace, 'botConnected' | 'botLastSeenAt' | 'botInGuild'>,
  now = Date.now(),
): BotHealth {
  if (!ws.botInGuild) return 'not_in_guild'
  const seen = ws.botLastSeenAt?.getTime() ?? 0
  if (ws.botConnected && now - seen <= BOT_ONLINE_WINDOW_MS) return 'online'
  if (ws.botConnected) return 'stale'
  return 'offline'
}

export async function getBotHealth(filter?: string) {
  const rows = await db
    .select({
      id: workspaces.id,
      umeId: workspaces.umeId,
      guildId: workspaces.guildId,
      guildName: workspaces.guildName,
      status: workspaces.status,
      botConnected: workspaces.botConnected,
      botLastSeenAt: workspaces.botLastSeenAt,
      botInGuild: workspaces.botInGuild,
      botVoiceChannelId: workspaces.botVoiceChannelId,
      homeVoiceChannelId: workspaces.homeVoiceChannelId,
      lastActivityAt: workspaces.lastActivityAt,
    })
    .from(workspaces)
    .where(inArray(workspaces.status, ['unclaimed', 'connected', 'disconnected']))
    .orderBy(desc(workspaces.botLastSeenAt))
    .limit(500)
  const now = Date.now()
  const classified = rows.map((r) => ({ ...r, health: classifyBot(r, now) }))
  const counts: Record<BotHealth, number> = { online: 0, stale: 0, offline: 0, not_in_guild: 0 }
  for (const r of classified) counts[r.health]++
  const wanted = (['online', 'stale', 'offline', 'not_in_guild'] as const).find((h) => h === filter)
  return {
    rows: wanted ? classified.filter((r) => r.health === wanted) : classified,
    counts,
    filter: wanted ?? null,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DMCA
// ────────────────────────────────────────────────────────────────────────────

export async function listDmcaNotices(status?: string) {
  const wanted = DMCA_STATUSES.find((s) => s === status)
  const [rows, countRows] = await Promise.all([
    db
      .select({
        notice: dmcaNotices,
        workspaceName: workspaces.guildName,
        trackTitle: tracks.title,
        trackStatus: tracks.status,
      })
      .from(dmcaNotices)
      .leftJoin(workspaces, eq(workspaces.id, dmcaNotices.workspaceId))
      .leftJoin(tracks, eq(tracks.id, dmcaNotices.trackId))
      .where(wanted ? eq(dmcaNotices.status, wanted) : undefined)
      .orderBy(desc(dmcaNotices.createdAt))
      .limit(200),
    db
      .select({ status: dmcaNotices.status, n: count() })
      .from(dmcaNotices)
      .groupBy(dmcaNotices.status),
  ])
  const counts = Object.fromEntries(DMCA_STATUSES.map((s) => [s, 0])) as Record<DmcaStatus, number>
  for (const c of countRows) counts[c.status] = num(c.n)
  return { rows, counts, filter: wanted ?? null }
}

export async function getDmcaNotice(id: string): Promise<{
  notice: DmcaNotice
  track: typeof tracks.$inferSelect | null
  workspace: Pick<Workspace, 'id' | 'umeId' | 'guildName' | 'status'> | null
  hashBlocked: boolean
} | null> {
  const notice = await db.query.dmcaNotices.findFirst({ where: eq(dmcaNotices.id, id) })
  if (!notice) return null
  const [track, workspace] = await Promise.all([
    notice.trackId
      ? db.query.tracks.findFirst({ where: eq(tracks.id, notice.trackId) })
      : Promise.resolve(undefined),
    notice.workspaceId
      ? db.query.workspaces.findFirst({
          where: eq(workspaces.id, notice.workspaceId),
          columns: { id: true, umeId: true, guildName: true, status: true },
        })
      : Promise.resolve(undefined),
  ])
  const blocked = track?.sha256
    ? await db.query.blockedHashes.findFirst({
        where: eq(blockedHashes.sha256, track.sha256),
        columns: { sha256: true },
      })
    : null
  return { notice, track: track ?? null, workspace: workspace ?? null, hashBlocked: !!blocked }
}

// ────────────────────────────────────────────────────────────────────────────
// Notifications
// ────────────────────────────────────────────────────────────────────────────

export async function listNotifications(opts: {
  page?: number
  pageSize?: number
  kind?: string
  status?: string
}) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE
  const kinds = notifications.kind.enumValues
  const kind = kinds.find((k) => k === opts.kind)
  const status =
    opts.status && ['sent', 'failed', 'skipped'].includes(opts.status) ? opts.status : undefined
  const where = and(
    kind ? eq(notifications.kind, kind) : undefined,
    status ? eq(notifications.status, status) : undefined,
  )
  const [rows, totalRow] = await Promise.all([
    db
      .select({
        n: notifications,
        workspaceName: workspaces.guildName,
        workspaceUmeId: workspaces.umeId,
      })
      .from(notifications)
      .leftJoin(workspaces, eq(workspaces.id, notifications.workspaceId))
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(notifications)
      .where(where)
      .then((r) => r[0]),
  ])
  return {
    rows,
    total: num(totalRow?.total),
    page,
    pageSize,
    kinds,
    kind: kind ?? null,
    status: status ?? null,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Audit
// ────────────────────────────────────────────────────────────────────────────

export const AUDIT_PREFIXES = [
  'ceo.',
  'workspace.',
  'token.',
  'member.',
  'invite.',
  'role.',
  'playlist.',
  'track.',
  'purge.',
  'reset.',
  'billing.',
] as const

export async function listAudit(opts: {
  page?: number
  pageSize?: number
  prefix?: string
  scope?: string
  workspaceId?: string
}) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE
  const prefix = (opts.prefix ?? '').trim().replace(/[%_\\]/g, '')
  const scope = opts.scope === 'global' ? 'global' : 'all'
  const where = and(
    scope === 'global' ? isNull(auditLogs.workspaceId) : undefined,
    prefix ? like(auditLogs.action, `${prefix}%`) : undefined,
    opts.workspaceId ? eq(auditLogs.workspaceId, opts.workspaceId) : undefined,
  )
  const [rows, totalRow] = await Promise.all([
    db
      .select({ log: auditLogs, actorEmail: users.email, workspaceName: workspaces.guildName })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .leftJoin(workspaces, eq(workspaces.id, auditLogs.workspaceId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(auditLogs)
      .where(where)
      .then((r) => r[0]),
  ])
  return { rows, total: num(totalRow?.total), page, pageSize, prefix, scope }
}

/** Purge candidates: free workspaces idle long enough that the sweep will notice them soon. */
export async function listIdleFreeWorkspaces(days = 30, limit = 10) {
  const cutoff = new Date(Date.now() - days * 86_400_000)
  return db
    .select({
      id: workspaces.id,
      umeId: workspaces.umeId,
      guildName: workspaces.guildName,
      lastActivityAt: workspaces.lastActivityAt,
    })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.plan, 'free'),
        eq(workspaces.status, 'connected'),
        lt(workspaces.lastActivityAt, cutoff),
      ),
    )
    .orderBy(asc(workspaces.lastActivityAt))
    .limit(limit)
}
