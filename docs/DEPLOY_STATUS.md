# Deployment status — September 16, 2026

The redesigned web app builds locally. It has **not** been deployed or connected to a production database during this pass.

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
