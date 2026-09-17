# @ume/web

The Ume web app: marketing site, sign-in, the per-server dashboard, the CEO console and the API routes. Next.js 16 App Router, React 19, Tailwind v4, Better Auth (Discord + Google), Drizzle via `@ume/db`.

```bash
pnpm dev:web                     # http://localhost:3000 (reads ../../.env through next.config.ts)
pnpm --filter @ume/web build     # next build
pnpm --filter @ume/web lint      # eslint (there is no `next lint`)
cd apps/web && pnpm exec tsc --noEmit
```

Deployment (Vercel, Root Directory `apps/web`) is described in [`docs/DEPLOY.md`](../../docs/DEPLOY.md#7-web-on-vercel).

## Route map

Route groups in `src/app/` keep four surfaces apart, each with its own layout. Access is enforced in server code (`requireUser`, `requireCeo`, `getAccess` + `can`) on every page, server action and route handler; `src/proxy.ts` only redirects to `/login` or `/ceo/login` when there is no session cookie (matcher: `/app/*`, `/ceo/*`).

### `(marketing)` — public

| Route                         | Purpose                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                           | Landing page: hero, how it works, features, pricing teaser, commands teaser, FAQ, CTA. "Add a song from a link" is described as exactly that, never as a converter. |
| `/pricing`                    | The four plans from `PLANS` in `@ume/shared`.                                                                                                                       |
| `/commands`                   | Command reference rendered from `COMMANDS` in `@ume/shared` (slash and `~` forms).                                                                                  |
| `/terms`, `/privacy`          | Legal pages; linked from the Discord application as required for verification. Effective date in `lib/site/links.ts`.                                               |
| `/dmca`                       | Designated agent details (`DMCA_AGENT_*`) and the §512(c)(3) takedown form (`dmca/actions.ts` → `dmca_notices`).                                                    |
| `/robots.txt`, `/sitemap.xml` | `robots.ts` and `sitemap.ts`.                                                                                                                                       |

### `(auth)` — sign-in

| Route     | Purpose                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------- |
| `/login`  | "Sign in with Discord" (primary) and Google. Honors `?next=` (validated by `lib/site/safe-next.ts`). |
| `/banned` | Shown to users with `users.banned = true`; sign-out only.                                            |

### `/invite/[token]` — accept an invite

Lives at the app root (`src/app/invite/[token]`), outside the groups, so it can work before the user has a workspace. Signs the user in if needed, runs the guild-membership / email checks, creates the membership and redirects into the workspace (`acceptInvite` in `lib/app/actions/invites.ts`).

### `(app)` — the dashboard, `/app/…`

All pages under `/app/[ws]` (the `ws` segment is the public `umeId`) resolve the workspace once in the layout (`lib/app/workspace.ts`), load `getAccess()`, and hide navigation items the member cannot use (`WORKSPACE_NAV` in `lib/app/nav.ts`, gated by capability).

| Route                            | Capability               | Purpose                                                                                                                                                                                                           |
| -------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app`                           | signed in                | Server switcher: workspaces the user belongs to, plus "connect a server".                                                                                                                                         |
| `/app/new`                       | signed in                | OAuth claim: pick a server where you are owner or Administrator (`canClaimGuild`), tick the rights attestation, install the bot first if missing; plain members join through role mapping / the default role.     |
| `/app/claim`                     | signed in                | Token claim: paste the `ume_…` token from `/reload` and tick the attestation.                                                                                                                                     |
| `/app/[ws]`                      | member                   | Overview: bot status, home channel, storage, recent activity.                                                                                                                                                     |
| `/app/[ws]/library`              | `VIEW_LIBRARY`           | Playlists grid; create/rename/delete with `MANAGE_PLAYLISTS`.                                                                                                                                                     |
| `/app/[ws]/library/[playlistId]` | `VIEW_LIBRARY`           | Tracks with "added by", drag-and-drop upload (`ADD_TRACK`, via `/api/upload/*`), add a song from a link, edit metadata (`EDIT_TRACK_META`), remove (`DELETE_OWN_TRACK` / `DELETE_ANY_TRACK`), retry failed items. |
| `/app/[ws]/members`              | `MANAGE_MEMBERS`         | Members, roles, removal, temporary access, Discord role mapping, default role.                                                                                                                                    |
| `/app/[ws]/roles`                | `MANAGE_ROLES`           | Capability editor; owner-only caps are not grantable.                                                                                                                                                             |
| `/app/[ws]/invites`              | `MANAGE_INVITES`         | Share links (Servant-level max) and email invites, expiry, revoke.                                                                                                                                                |
| `/app/[ws]/activity`             | `VIEW_LIBRARY`           | Activity feed and workspace audit log.                                                                                                                                                                            |
| `/app/[ws]/settings`             | `MANAGE_SETTINGS`        | Home and notice channels, "Add from link" switch, rights attestation (Owner), enter a new token after `/reload`, Ume ID; Danger Zone (`DANGER_ZONE`, Owner): reset and purge with the server name typed.          |
| `/app/[ws]/billing`              | `MANAGE_BILLING` (Owner) | Plan, usage, Stripe Checkout and Customer Portal (form posts to `/api/stripe/*`).                                                                                                                                 |

Server actions live in `src/lib/app/actions/*.ts` (`workspaces`, `playlists`, `tracks`, `members`, `roles`, `invites`, `settings`, `danger`) and go through `guard()` / `guardOwner()` from `lib/app/guard.ts`, which wraps `requireUser` + `getAccess` + `can` and returns `{ ok, data | error }` via `runAction()`.

### `(ceo)` — `/ceo/…`

Gated by `requireCeo()` in the `(console)` layout (Google session, verified email, `CEO_EMAILS`). Navigation in `lib/ceo/nav.ts`; actions in `lib/ceo/actions.ts` (every one calls `requireCeo()` then `logAudit({ action: 'ceo.*' })`).

| Route                                     | Purpose                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/ceo/login`                              | Google sign-in only; `?denied=1` explains a refused account.                                                                         |
| `/ceo`                                    | Overview: workspaces by status, storage, paid count, bot online count, charts.                                                       |
| `/ceo/workspaces`, `/ceo/workspaces/[id]` | Every server that met the bot; quota and plan override, disconnect, reset, purge, reset the inactivity clock.                        |
| `/ceo/users`, `/ceo/users/[id]`           | Accounts, Discord links, memberships, ban/unban with reason.                                                                         |
| `/ceo/storage`                            | Usage by workspace; trigger `reconcile-storage` (`lib/ceo/queue.ts`).                                                                |
| `/ceo/revenue`                            | Paid workspaces and MRR from `workspaces.plan`.                                                                                      |
| `/ceo/bot`                                | Heartbeats (`bot_last_seen_at`) and voice presence per server.                                                                       |
| `/ceo/flags`                              | `link_extract` (on by default, with the ToS warning), `uploads_enabled`, `signups_open`, `auto_purge_enabled`, `maintenance_banner`. |
| `/ceo/dmca`                               | Notices, disable tracks, block hashes, status transitions, notes.                                                                    |
| `/ceo/notifications`                      | Outbound email / DM / channel messages.                                                                                              |
| `/ceo/audit`                              | Global audit log.                                                                                                                    |

`nav.ts` is the intended set; pages that are not in `src/app/(ceo)` yet are being landed alongside their actions.

### `api/` — route handlers

| Route                            | Auth                                              | Purpose                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/[...all]`             | —                                                 | Better Auth handler (OAuth callbacks at `/api/auth/callback/discord` and `/api/auth/callback/google`, session endpoints).                                |
| `/api/upload/presign`            | session + `ADD_TRACK`, `uploads_enabled`          | Validates the file, reserves quota, creates the pending track and returns a presigned R2 `PUT` (10 minutes).                                             |
| `/api/upload/complete`           | session + `ADD_TRACK`, uploader only              | `HEAD`s the object, checks the size matches, enqueues `transcode-upload`, touches activity; or marks the track failed when the browser reports an error. |
| `/api/stripe/checkout`           | session + `MANAGE_BILLING`, same-origin form POST | New subscribers → Checkout; existing → Customer Portal plan change.                                                                                      |
| `/api/stripe/portal`             | session + `MANAGE_BILLING`, same-origin form POST | Opens the Customer Portal.                                                                                                                               |
| `/api/stripe/webhook`            | Stripe signature                                  | `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`; idempotent via `stripe_events`.                                       |
| `/api/discord/channels`          | session + workspace access                        | Voice/text channel lists for the Settings pickers (bot token, server-side).                                                                              |
| `/api/tracks/[trackId]/download` | session + `VIEW_LIBRARY`                          | Short-lived presigned download of a ready track.                                                                                                         |

There is no `/api/cron/*`; the worker schedules the sweeps with pg-boss. `CRON_SECRET` is reserved for it.

## Library code

| Path                                              | Purpose                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/auth.ts`, `auth-client.ts`, `session.ts` | Better Auth server/client and `getSession` / `requireUser` / `requireCeo` / `getDiscordAccessToken`.                                                                                                                                                          |
| `src/lib/db.ts`                                   | `db` (Drizzle) plus re-exports of `@ume/db`.                                                                                                                                                                                                                  |
| `src/lib/queue.ts`                                | pg-boss producer for the app (`enqueue(name, payload)` with `JOB_OPTIONS`); `lib/ceo/queue.ts` is the short-lived variant for the console.                                                                                                                    |
| `src/lib/stripe.ts`                               | Stripe client, price ↔ plan mapping, Checkout and Portal sessions.                                                                                                                                                                                            |
| `src/lib/discord-api.ts`                          | Discord REST helpers: OAuth guilds (user token), guild / roles / channels / member lookups (bot token).                                                                                                                                                       |
| `src/lib/app/*`                                   | Dashboard guards (`guard.ts`), nav, workspace loading and role resolution (`workspace.ts`), library helpers, upload quota reservation (`upload.ts`), link metadata and the three extraction gates (`links.ts`), same-origin check (`request.ts`), formatting. |
| `src/lib/ceo/*`                                   | Console queries, actions, nav, queue controls.                                                                                                                                                                                                                |
| `src/lib/site/*`                                  | Public links, safe `next` redirects, request IP.                                                                                                                                                                                                              |
| `src/components/ui`                               | Primitives: Button, Input/Textarea/Label/Select, Card, Badge, Logo, Dialog, DropdownMenu, EmptyState, Switch, Checkbox, Tooltip, Toaster (add new primitives here with distinct names).                                                                       |
| `src/components/{marketing,site,app,ceo}`         | Surface-specific components.                                                                                                                                                                                                                                  |

## Conventions

- Light UI with the tokens in `src/app/globals.css` (white page, navy text and primary actions, blue and lilac surfaces, violet emphasis; see `docs/DESIGN_REVIEW.md`). Semantic success/warning/danger colors are separate from the palette. Public surfaces are borderless and separated by spacing; outlines are reserved for fill buttons, provider sign-in buttons and the dashed upload illustration. Readable at 320 px. Icons come from the Icones catalog through `src/components/ui/icons.tsx` (`public/icons/NOTICE.md`), never emoji or a runtime icon package.
- `params`, `searchParams`, `cookies()` and `headers()` are async in Next.js 16 (`const { ws } = await params`).
- Prefer `revalidatePath`; `revalidateTag` needs its second argument.
- Never log tokens or codes. Never trust a Discord id from a form; it comes from the session (`user.discordUserId`).
- The user-facing word is "playlist"; the link feature is "add a song from a link".
