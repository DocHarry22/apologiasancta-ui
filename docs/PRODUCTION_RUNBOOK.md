# Production runbook

## Current targets

- Frontend: `https://sandybrown-bear-488955.hostingersite.com` (Hostinger, Node/Next runtime).
- Engine: `https://apologiasancta-engine.onrender.com` (Render, `main`, auto-deploy).
- Research graph: `https://mediumvioletred-kingfisher-797460.hostingersite.com`.

The Next app uses middleware, route handlers, staff sessions and server-side engine proxies. Do not deploy it as a static export. Hostinger must install development build dependencies, run `npm run build`, and serve `npm start` from the repository root.

## Required environment

### UI/Hostinger

- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_URL=https://sandybrown-bear-488955.hostingersite.com`
- `NEXT_PUBLIC_ENGINE_URL=https://apologiasancta-engine.onrender.com`
- `ENGINE_INTERNAL_URL=https://apologiasancta-engine.onrender.com`
- `AUTHOR_SESSION_SECRET` (high-entropy, server only)
- `ENGINE_ADMIN_TOKEN` (UI server only; must match the Engine's `ADMIN_TOKEN`)
- `DATABASE_URL` for durable staff/workflow/audit storage
- `LEARNING_CLOUD_SYNC_ENABLED=true` only after `npm run db:migrate:learning` succeeds against the same database
- Optional: `LEARNING_DB_POOL_SIZE` (default `5`), `DB_CONNECT_TIMEOUT_MS` (default `10000`)
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` for initial bootstrap only; rotate after first successful durable login
- Optional: `NEXT_PUBLIC_ANDROID_APK_URL`, `CAPACITOR_SERVER_URL`, `NEXT_PUBLIC_RESEARCH_GRAPH_URL`, `NEXT_PUBLIC_AUTHOR_ENABLED`

### Engine/Render

- `NODE_ENV=production`
- `PORT` (Render supplies this; blueprint default is `10000`)
- `ADMIN_TOKEN` (high-entropy, must match UI `ENGINE_ADMIN_TOKEN`)
- `PLAYER_JOIN_SECRET` (new independent high-entropy secret)
- `CORS_ORIGINS=https://sandybrown-bear-488955.hostingersite.com`
- `ALLOW_LOCAL_ORIGINS=false`
- `DATABASE_URL` (Render PostgreSQL connection)
- `STATE_PERSISTENCE_DRIVER=postgres`
- Optional: `YOUTUBE_API_KEY`, `YOUTUBE_VIDEO_ID`, phase duration values

Never expose `ENGINE_ADMIN_TOKEN`, `ADMIN_TOKEN`, `PLAYER_JOIN_SECRET`, database credentials or Supabase service-role keys through `NEXT_PUBLIC_*` variables.

### Android CI and release signing

The `Android CI` workflow is a required, secret-free build gate for pull requests and `main`. It installs JDK 21 and Android SDK 35, syncs Capacitor, runs Android unit tests and lint, assembles a debug APK, verifies the APK signature, and uploads the APK as a short-lived workflow artifact.

Signed APK/AAB releases run only for an `android-v*` tag or a trusted manual dispatch. The release job is skipped unless all four repository secrets exist:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded JKS/keystore file.
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- `ANDROID_KEY_ALIAS`: signing key alias.
- `ANDROID_KEY_PASSWORD`: signing key password.

Store these values as GitHub Actions repository secrets. Never store the decoded keystore or passwords in the repository, workflow inputs, artifacts, logs, or `NEXT_PUBLIC_*` variables. The workflow decodes the keystore with owner-only permissions into the runner's temporary directory and removes it in an `always()` cleanup step. Signed APK and AAB signatures are verified before publishing, and the artifact includes SHA-256 checksums.

The optional non-secret repository variables `ANDROID_APP_URL`, `ANDROID_ENGINE_URL`, and `ANDROID_GRAPH_URL` override the documented production URL defaults. A manual signed build uploads a private workflow artifact by default; enable `publish_release` explicitly to attach it to the requested GitHub release. Tag-triggered builds publish automatically.

### Authenticated learning progress rollout

1. Back up the UI account database and confirm `admin_users` already exists; it remains the account identity authority.
2. From the reviewed UI source with server-only database variables loaded, run `npm run db:migrate:learning`. The PostgreSQL/MySQL DDL is repeatable and records migration `2026071601_authenticated_learning_progress` in `app_schema_migrations`.
3. Leave `LEARNING_CLOUD_SYNC_ENABLED=false`, deploy, and smoke-test sign-in plus local/offline learning. The API returns a non-secret `503` local-fallback contract while disabled.
4. Set `LEARNING_CLOUD_SYNC_ENABLED=true`, redeploy, sign in with a non-privileged learner account, complete a lesson offline, reconnect, and confirm `/api/learning/progress` merges rather than replaces both copies.
5. Confirm no `accountId` is accepted in a sync payload, POST without a valid CSRF token is rejected, a retried practice mutation does not increment twice, and another signed-in account cannot read the first account's data.

See `docs/AUTHENTICATED_LEARNING_PROGRESS.md` for schema, API, merge, rollback, and current deletion limitations. Do not enable this flag if the migration or database health check fails.

## Release order

1. Review both coordinated pull requests and confirm every required check is green.
2. Confirm Hostinger's Git integration is connected to `DocHarry22/apologiasancta-ui`, production branch `main`, Node 22+, build `npm ci --include=dev && npm run build`, start `npm start`.
3. Merge and deploy the UI first. Its registration and answer clients deliberately support both the deployed legacy Engine and the signed-session Engine contract.
4. Verify `/`, `/login`, `/account`, `/privacy`, `/learn`, `/practice`, `/mobile`, `/leaderboard`, `/library`, `/research` and `/admin/login`, including a legacy room join and answer smoke test.
5. Add a newly generated `PLAYER_JOIN_SECRET` of at least 32 random bytes to Render. Never copy an example value from the repository.
6. Merge the Engine PR; wait for Render `/health` to report healthy PostgreSQL persistence and check `/diagnostics` for readiness booleans only.
7. Smoke-test signed registration, room join, answer, SSE reconnect and leaderboard with a non-public test room. Confirm browser requests use the Render HTTPS origin and that an unapproved Origin is rejected.

Merging GitHub cannot update Hostinger unless that project has automatic Git deployment enabled. If it does not, deploy the exact merged UI commit through Hostinger and record the commit SHA in the release notes.

## Health and rollback

- Engine: `GET /health` for service/persistence health; `GET /diagnostics` for non-secret configuration readiness.
- UI: `GET /` and `GET /manifest.webmanifest`.
- Roll back Render to the previous successful deployment if health, persistence restore or signed room joins fail.
- Roll back Hostinger to the prior deployment if page routing, staff login or engine connectivity fails.
- Do not rotate `PLAYER_JOIN_SECRET` during a live room; rotation intentionally invalidates active room sessions and players must rejoin.
