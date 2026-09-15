# @ume/web

The Ume web app: marketing site, sign-in, the per-server dashboard, the CEO console and the API routes. Next.js 16 App Router, React 19, Tailwind v4, Better Auth (Discord + Google), Drizzle via `@ume/db`.

```bash
pnpm dev:web                     # http://localhost:3000 (reads ../../.env)
pnpm --filter @ume/web build     # next build
cd apps/web && pnpm exec tsc --noEmit
```

Deployment (Vercel, Root Directory `apps/web`) is described in [`docs/DEPLOY.md`](../../docs/DEPLOY.md#7-web-on-vercel).

## Route map

Route groups in `src/app/` keep four surfaces apart, each with its own layout. Access is enforced in server code (`requireUser`, `requireCeo`, `getAccess` + `can`) on every page, server action and route handler; `src/proxy.ts` only redirects to `/login` or `/ceo/login` when there is no session cookie.

### `(marketing)` — public

| Route | Purpose |
| --- | --- |
| `/` | Landing page: hero, how it works, features, pricing teaser, commands teaser, FAQ, CTA. |
| `/pricing` | The four plans from `PLANS` in `@ume/shared`. |
| `/commands` | Command reference rendered from `COMMANDS` in `@ume/shared` (slash and `~` forms). |
| `/terms`, `/privacy` | Legal pages; linked from the Discord application as required for verification. |
| `/dmca` | Designated agent details (`DMCA_AGENT_*`) and the §512(c)(3) takedown form (`dmca/actions.ts` → `dmca_notices`). |

### `(auth)` — sign-in

| Route | Purpose |
| --- | --- |
| `/login` | "Sign in with Discord" (primary) and Google. Honors `?next=` (validated by `lib/site/safe-next.ts`). |
| `/banned` | Shown to users with `users.banned = true`. |
| `/invite/[token]` | Accept a share link or email invite: sign-in if needed, guild-membership / email checks, then membership + redirect to the workspace. |

### `(app)` — the dashboard, `/app/…`

All pages under `/app/[umeId]` resolve the workspace by its public `umeId`, load `getAccess()` once in the layout, and hide navigation items the member cannot use (`WORKSPACE_NAV` in `lib/app/nav.ts`, gated by capability).

| Route | Capability | Purpose |
| --- | --- | --- |
| `/app` | signed in | Server switcher: workspaces the user belongs to, plus "connect a server". |
| `/app/new` | signed in | OAuth claim: pick a server where you are owner or Administrator (`canClaimGuild`); install the bot first if missing. |
| `/app/claim` | signed in | Token claim: paste the `ume_…` token from `/reload`. |
| `/app/[umeId]` | member | Overview: bot status, home channel, storage, recent activity. |
| `/app/[umeId]/library` | `VIEW_LIBRARY` | Playlists grid; create/rename/delete with `MANAGE_PLAYLISTS`. |
| `/app/[umeId]/library/[playlistId]` | `VIEW_LIBRARY` | Tracks with "added by", drag-and-drop upload (`ADD_TRACK`), YouTube links, edit metadata (`EDIT_TRACK_META`), remove (`DELETE_OWN_TRACK` / `DELETE_ANY_TRACK`). |
| `/app/[umeId]/members` | `MANAGE_MEMBERS` | Members, roles, removal, Discord role mapping. |
| `/app/[umeId]/roles` | `MANAGE_ROLES` | Capability editor; owner-only caps are not grantable. |
| `/app/[umeId]/invites` | `MANAGE_INVITES` | Share links (Servant-level max) and email invites, expiry, revoke. |
| `/app/[umeId]/activity` | `VIEW_LIBRARY` | Activity feed and workspace audit log. |
| `/app/[umeId]/settings` | `MANAGE_SETTINGS` | Home channel, notice channel, role sync, YouTube opt-out, enter a new token after `/reload`, Ume ID. |
| `/app/[umeId]/billing` | `MANAGE_BILLING` (Owner) | Plan, usage, Stripe Checkout and Customer Portal. |
| Danger Zone (in Settings) | `DANGER_ZONE` (Owner) | Reset and purge with typed server name (`lib/app/actions/danger.ts`). |

Server actions live in `src/lib/app/actions/*.ts` (`playlists`, `tracks`, `members`, `roles`, `invites`, `settings`, `danger`, `workspaces`) and go through `guard()` / `guardOwner()` from `lib/app/guard.ts`, which wraps `requireUser` + `getAccess` + `can` and returns `{ ok, data | error }`.

### `(ceo)` — `/ceo/…`

Gated by `requireCeo()` (Google session, verified email, `CEO_EMAILS`). Navigation in `lib/ceo/nav.ts`.

| Route | Purpose |
| --- | --- |
| `/ceo/login` | Google sign-in only. |
| `/ceo` | Overview: workspaces by status, storage, paid count, bot online count, charts. |
| `/ceo/workspaces`, `/ceo/workspaces/[id]` | Every server that met the bot; quota override, re-enqueue purge, view members. |
| `/ceo/users` | Accounts, Discord links, ban/unban with reason. |
| `/ceo/storage` | Usage by workspace; trigger `reconcile-storage`. |
| `/ceo/revenue` | Paid workspaces and MRR from `workspaces.plan`. |
| `/ceo/bot` | Heartbeats (`bot_last_seen_at`) and voice presence per server. |
| `/ceo/flags` | `link_extract`, `uploads_enabled`, `signups_open`, `auto_purge_enabled`, `maintenance_banner`. |
| `/ceo/dmca` | Notices, disable tracks, block hashes, status transitions. |
| `/ceo/notifications` | Outbound email / DM / channel messages. |
| `/ceo/audit` | Global audit log. |

### `api/` — route handlers

| Route | Auth | Purpose |
| --- | --- | --- |
| `/api/auth/[...all]` | — | Better Auth handler (OAuth callbacks at `/api/auth/callback/discord` and `/api/auth/callback/google`, session endpoints). |
| `/api/stripe/webhook` | Stripe signature | `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`; idempotent via `stripe_events`. |
| `/api/cron/*` | `Authorization: Bearer $CRON_SECRET` | Optional Vercel Cron triggers for the sweeps (the worker schedules them with pg-boss by default). |
| Upload presign / complete | session + `ADD_TRACK` | Issues the presigned R2 `PUT` and enqueues `transcode-upload` once the browser finishes. Implemented as a server action or under `/api/uploads/*` depending on the library page. |

Check `src/app/` for the live tree; this map is the intended layout and is kept in sync as pages land.

## Library code

| Path | Purpose |
| --- | --- |
| `src/lib/auth.ts`, `auth-client.ts`, `session.ts` | Better Auth server/client and `getSession` / `requireUser` / `requireCeo` / `getDiscordAccessToken`. |
| `src/lib/db.ts` | `db` (Drizzle) plus re-exports of `@ume/db`. |
| `src/lib/queue.ts` | pg-boss producer (`enqueue(name, payload)` with `JOB_OPTIONS`). |
| `src/lib/stripe.ts` | Stripe client, price ↔ plan mapping, Checkout and Portal sessions. |
| `src/lib/discord-api.ts` | Discord REST helpers (OAuth guilds, guild membership). |
| `src/lib/app/*` | Dashboard guards, nav, workspace loading, library helpers, formatting. |
| `src/lib/ceo/*` | Console queries, actions, nav, queue controls. |
| `src/lib/site/*` | Public links, safe `next` redirects, request IP. |
| `src/components/ui` | Primitives: Button, Input/Textarea/Label/Select, Card, Badge, Logo (add new primitives here). |
| `src/components/{marketing,site,ceo}` | Surface-specific components. |

## Conventions

- Dark UI with the tokens in `src/app/globals.css`; pink is the only accent; rounded-2xl cards; readable at 400 px.
- `params`, `searchParams`, `cookies()` and `headers()` are async in Next.js 16.
- Prefer `revalidatePath`; `revalidateTag` needs its second argument.
- Never log tokens or codes. Never trust a Discord id from a form.
- The word is "playlist", not playlist.
