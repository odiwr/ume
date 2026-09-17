# Deployment status — September 16, 2026 (evening pass)

The web app, bot and worker build locally and all seven workspace type checks pass. Nothing has been deployed or connected to a production database yet.

## Code changes in this pass

- Added the missing `/invite/[token]` page. Share links and invite emails already pointed there; the acceptance action existed but had no route. Signed-out visitors go to `/login?next=/invite/<token>`; signed-in visitors see the server, role and expiry before accepting.
- Email no longer reports success in production without `RESEND_API_KEY`. Invites keep `emailSentAt` empty and show a copyable link instead; the worker's send-email job fails and retries; the bot logs and continues.
- DMCA submissions now email the designated agent (`DMCA_AGENT_EMAIL`, falling back to the first `CEO_EMAILS` entry) through the worker. This adds one migration, `0001_notification_kind_dmca` (new `notification_kind` value), which must be applied together with `0000_init`.
- Lint works again: `apps/web` pins ESLint 9 because `eslint-plugin-react` 7.37 does not support ESLint 10. CI runs lint and the new `@ume/shared` unit tests in addition to typecheck and build.
- Public commands, DMCA and privacy pages use the borderless tinted panels from the design review.

## Toolchain note for Windows

The standalone `pnpm.exe` cannot self-install pnpm 12.4.1 (no Windows binary is published for that version). Run scripts as `npx -y pnpm@12.4.1 --config.manage-package-manager-versions=false <script>`; `.claude/launch.json` already does this for the preview server. Vercel CLI (`npx vercel`) reports that a new login is required; run `vercel login` interactively before deploying.

Run `pnpm deploy:check` from the repository root before deploying. This reads local configuration and reports variable names only. It does not send email, provision infrastructure, apply migrations, or prove that supplied credentials work.

## Verified access and configuration

- Git remote: `https://github.com/odiwr/ume.git`.
- Vercel: browser and CLI sign-in are verified. Created and linked project `odiwr/ume` (`prj_0GFrBMbvETIFFJKNHNsq6QdcfkZl`), configured Next.js, root `apps/web`, and Node 22. Production environment variables are not configured. The connector still returns an empty team list, so use the authenticated CLI. No deployment was published.
- Supabase: the connected account lists one inactive project, `odiwr-postgres`, in `us-west-2`. No project named Ume was found and no existing database was changed. DEPLOY.md currently specifies Neon; database provider selection remains to be confirmed.
- Resend: `memorymission.org` is verified. This is not evidence that the founder owns `ume.app`, and it was not reused for Ume.
- `ume.app` is an example throughout the original deployment guide, not a confirmed domain. Await the founder's domain before changing DNS, OAuth callbacks, or sending identities.

## Configuration still needed

The local `.env` contains development/placeholder origins and database/auth values. Missing production inputs:

- Postgres pooled and session/direct connection strings; apply the committed Drizzle migration to the selected database.
- Discord application ID, client secret, and bot token; configure callback URLs and installation settings.
- Google client ID and secret; configure callbacks and confirm the CEO allow-list.
- A fresh Better Auth secret and matching HTTPS app/auth/public origins.
- R2 access key and secret, a verified bucket and upload CORS configuration.
- Stripe secret, webhook secret, and the three recurring plan price IDs.
- A Resend sending key and a sender on the confirmed, verified domain.
- Published DMCA contact values and the registration described in DEPLOY.md.
- Railway or Fly hosting for the persistent bot and worker, plus the chosen extractor arrangement.

## Resume sequence

1. Confirm the database provider and owned domain. Vercel access is ready.
2. Follow DEPLOY.md in order to configure identities, database, storage, billing, and mail. Do not paste secrets into chat or commit `.env`.
3. Run the deployment preflight, type check, and build. Use the linked Vercel project with `apps/web` as root and access to workspace packages.
4. Deploy the web, bot, and worker. Register commands and verify the full Discord sign-in → server claim → upload/link → worker → playback flow.
5. Verify billing and email delivery with explicit test accounts. Do not send messages to other people as part of deployment without founder authorization.

Local public-page rendering is verified separately in DESIGN_REVIEW.md. A successful marketing build does not mean that the bot or backend is live.
