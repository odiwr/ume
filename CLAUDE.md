# CLAUDE.md — working in the Ume repo

Ume is a 24/7 Discord music bot with a web app. pnpm + Turborepo monorepo, Node 22, TypeScript strict, Prettier (no semicolons, single quotes, width 100).

## Where decisions live

- `docs/PLAN_REVIEW.md` is the product decision record. Do not change behaviour that contradicts it; change the document first.
- `docs/ARCHITECTURE.md` explains flows and the security model; `docs/DEPLOY.md` and `docs/OPERATIONS.md` are for running it.
- Contracts every app shares: `packages/shared/src/*.ts` (roles/caps, tokens, commands, plans, jobs, zod schemas) and `packages/db/src/{schema,queries}/*.ts`. Read them before writing app code; do not duplicate their constants.

## Package roles

| Path               | Role                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`         | Next.js 16 App Router, React 19, Tailwind v4, Better Auth (Discord + Google). Marketing, `/app/<umeId>` dashboard, `/ceo` console, API routes. |
| `apps/bot`         | discord.js 14 + @discordjs/voice. Slash commands generated from `COMMANDS`; `~` prefix as alias. Streams stored Opus, no transcoding.          |
| `apps/worker`      | pg-boss consumers: transcode, YouTube ingest (flag-gated), sweeps, purge, email.                                                               |
| `packages/shared`  | `@ume/shared` constants, ids, CAP bitmasks, token helpers, Discord helpers, plans, validation, command list, job names/payloads.               |
| `packages/db`      | `@ume/db` Drizzle schema, relations, migrations (`drizzle/`), query helpers (`getAccess`, `claimToken`, `logAudit`, …).                        |
| `packages/storage` | `@ume/storage` S3/R2 client, presigned URLs, key layout under `ws/<workspaceId>/`.                                                             |
| `packages/email`   | `@ume/email` Resend sender (dry-run without key) and templates.                                                                                |

## Ownership boundaries

- Product/shared contracts (`packages/*`), root config (`package.json`, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`), and `apps/web/src/lib/{auth,auth-client,session,db,utils}.ts`, `apps/web/src/proxy.ts`, `apps/web/src/app/{layout.tsx,globals.css}` change rarely and deliberately. Propose changes there explicitly instead of editing them as a side effect of feature work.
- Do not add dependencies casually. If a feature truly needs one, say so and explain why the installed set does not cover it.
- Each app has its own README and Dockerfile; keep them next to the code they describe.

## Authorization on every server action and route handler

No exceptions, no "the layout already checked":

```ts
'use server'
const session = await requireUser()
const access = await getAccess(db, workspaceId, session.user.id)
if (!can(access, CAP.MANAGE_PLAYLISTS)) throw new Error('Forbidden')
// owner-only: if (!access?.isOwner) …
// CEO: const session = await requireCeo()
```

- Scope every query by `workspaceId` (no IDOR by playlist/track/invite id alone).
- Validate input with zod (schemas in `@ume/shared` where they exist).
- `logAudit()` for every privileged mutation.
- Never trust Discord ids from user input; they come from OAuth (`users.discordUserId`) or the gateway.
- Tokens and confirmation codes are stored hashed (`hashToken`); show the clear value once.
- `src/proxy.ts` is a cookie-presence gate only, not authorization.

## Next.js 16 gotchas

- `params`, `searchParams`, `cookies()`, `headers()` are async: `const { umeId } = await params`.
- Route protection file is `src/proxy.ts` (not middleware.ts); it runs on the Node runtime.
- Server Actions live in files starting with `'use server'`; Client Components start with `'use client'`.
- `revalidateTag(tag, 'max')` needs the second argument; prefer `revalidatePath`.
- There is no `next lint`; use `pnpm --filter @ume/web lint` (eslint) if needed.
- Docs are bundled at `apps/web/node_modules/next/dist/docs/` when unsure.

## Design

Cool light UI with the tokens in `apps/web/src/app/globals.css`: white background, navy text and primary actions, blue and lilac surfaces, and accessible violet emphasis. See `docs/DESIGN_REVIEW.md` for the Halsa-inspired layout. The public header is static and opaque, never sticky or blurred. Use subtle equalizer/accordion motion and respect reduced-motion preferences. Public pages use borderless surfaces separated by spacing and soft color; reserve outlines for fill buttons, provider sign-in buttons, and the dashed upload illustration. Use deliberate grouping, generous spacing, and layouts readable at 320 px. All interface icons come from the Icones catalog through `src/components/ui/icons.tsx`; see `public/icons/NOTICE.md`. Keep copy direct and specific; avoid slogans and buzzwords. Use the primitives in `src/components/ui`. Real copy, no lorem ipsum. The user-facing word is "playlist" everywhere (never "bucket" or "folder").

## Verify

```bash
pnpm typecheck                                   # everything (turbo)
cd apps/web && pnpm exec tsc --noEmit            # one app
cd apps/bot && pnpm exec tsc --noEmit
cd apps/worker && pnpm exec tsc --noEmit
pnpm build                                       # next build + tsup
```

There may be no database reachable locally: verify with typecheck and build, do not run migrations or the apps against a DB unless `DATABASE_URL` is real. Do not start dev servers from automated sessions.

## Never

- Commit `.env` or any secret. `.env.example` is the only env file in git.
- Log tokens, codes, or `process.env`.
- Call the link extractor a "converter" in marketing or help text. It is ON by default (founder decision, 2026-09-15) as "add a song from a link"; keep the rights attestation, the `link_extract` kill switch and the DMCA flow intact.
- Grant `MANAGE_BILLING` or `DANGER_ZONE` to a non-Owner role, or let a share link grant more than `roleGrantableByLink()` allows.
