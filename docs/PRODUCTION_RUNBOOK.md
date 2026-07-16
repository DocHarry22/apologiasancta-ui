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
