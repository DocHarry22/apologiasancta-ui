# Apologia Sancta operational audit

Audit date: 2026-07-15

## System map

| Repository | Responsibility | Production target | Deployment control |
| --- | --- | --- | --- |
| `DocHarry22/apologiasancta-ui` | Next.js 16/React 19 web app, PWA, Android wrapper, public learning/library/live play, staff authentication, authoring and admin proxy | Hostinger: `https://sandybrown-bear-488955.hostingersite.com` | Hostinger project configuration must deploy `main`; this repository does not contain a Hostinger deployment action |
| `DocHarry22/apologiasancta-engine` | Express 5 REST/SSE game engine, rooms, controller, scoring, question bank, leaderboards and runtime persistence | Render: `https://apologiasancta-engine.onrender.com` | `render.yaml` tracks `main` with auto-deploy |
| `DocHarry22/apologia-graph` | Vite/React research explorer with an Express API for claims, sources, references and workspace data | Hostinger: `https://mediumvioletred-kingfisher-797460.hostingersite.com` | Hostinger deployment/process configuration is external to the repository |
| UI repository (shared content/contracts) | Bundled question records, content validation, API response types and learning content | Built into the UI; questions are also managed through the engine/admin workflow | Same as UI |

There is no active Supabase client or Supabase migration set. The engine uses PostgreSQL for atomic runtime snapshots in production. The UI can use PostgreSQL or MySQL for staff accounts, workflow records and audit data. Service-role credentials must never be exposed as `NEXT_PUBLIC_*` values.

## Flow audit

- Home: now provides one honest learner hub for formation, practice, live room state, research and discovery without invented production statistics.
- Login/register: combined learner/staff authentication is role-aware and preserves server-side sessions, CSRF checks, throttling, safe diagnostics and correlation IDs. Live-player identity remains intentionally lightweight.
- Learner dashboard: `/learn` uses device-local completion state, labels that scope explicitly, and presents a structured four-stage formation path.
- Host dashboard: existing `/admin` and `/author` consoles cover live controls, rooms, bank, authoring, review, topics and audit.
- Join/play: `/mobile` supports room switching, REST state snapshots, SSE reconnect and polling fallback. The UI accepts both the deployed legacy registration response and the new signed room-session response so the compatible UI can be released before the stricter engine.
- Results/leaderboards: live score, room rankings and global daily/weekly/all-time views exist; a public leaderboard route was added.
- Content library/admin: existing topic library and role-aware question workflow are operational; published explanation references are now mandatory.

## Findings and treatment

### Fixed in this branch

- Added the missing product spine: sourced learning path, lesson pages, practice assessment, learner progress and public leaderboard.
- Removed hardcoded deployment assumptions from new client work and documented public/internal engine URLs separately.
- Bound room identity and answer submission to HMAC-signed, expiring room tokens; blocked duplicate and out-of-window answers server-side.
- Consolidated duplicate room answer/register routes through the secured handlers.
- Added production-safe CORS resolution, player/request rate limits, request IDs, bounded JSON bodies and non-secret diagnostics.
- Made production fail fast when `ADMIN_TOKEN` or `PLAYER_JOIN_SECRET` is absent.
- Aligned Render with PostgreSQL snapshot persistence and removed the unused Redis resource/scaffolding.
- Added empty/loading/error states to new flows, accessible focus styles, semantic controls, PWA shell routes, robots and sitemap metadata.
- Added a semantic light/dark/system theme, a shared responsive shell, mobile navigation, a dismissible Graph promotion, a focused auth experience and a role-aware Account page.
- Rebuilt Home, Learn, Library, Research and Leaderboard around real Engine/bundled data with explicit device-local and external-application labels.
- Added source enforcement and regression coverage across the complete published question collection.
- Cleared lint warnings and verified both production builds.

### Risks that remain

- Player accounts are not durable authenticated learner accounts. Device progress and room identity are appropriate for MVP access, not prizes or paid competition.
- PostgreSQL persistence stores durable engine snapshots, not a normalized analytics/leaderboard model. Controllers are room-scoped but remain in one Node process, so the engine must not scale horizontally yet.
- Hostinger deployment ownership cannot be proven from repository configuration. A maintainer must confirm the Hostinger Git integration targets `main`, or deploy the merged commit manually.
- The Graph deployment is stale or uses different server configuration from current `main`: deep browser routes still return 404, unknown API routes return HTML, and illustrative category/workspace counters substantially exceed the 13 actual records. Redeploy current reviewed source and remove or clearly label demo counters before promotion.
- The full legacy question bank has references, but still requires an accountable human theological/editorial review before public endorsement.
- Android signing and store distribution still require the configured keystore secrets and a release rehearsal.

## Deployment blockers

Deploy the dual-contract UI first and verify legacy live-room play. Before deploying the stricter engine, configure a non-placeholder `PLAYER_JOIN_SECRET` containing at least 32 random bytes on Render. Then confirm Hostinger and Render build the exact reviewed commits. See `docs/PRODUCTION_RUNBOOK.md`.

## Verification snapshot

- UI: full ESLint pass; TypeScript pass during the production build; 32/32 Node tests; 99/99 Vitest tests across 24 files; 11/11 cold Chromium journeys; 48/48 generated routes in the Next production build; full and production-only dependency audits report zero known vulnerabilities.
- Capacitor production sync passes against the HTTPS Hostinger URL and records the splash-screen plugin in Android Gradle configuration. Local `assembleDebug` is blocked because this workstation has no Android SDK (`ANDROID_HOME`/`ANDROID_SDK_ROOT`, `local.properties`, `adb` and `sdkmanager` are absent); no APK was produced or claimed. GitHub Android CI remains the next executable SDK-backed check.
- Engine: TypeScript and production build pass; 19/19 tests pass, including room timing, duplicate prevention, signed tokens, secret validation, CORS, persistence, rate limiting and diagnostics. Dependency audits report zero known vulnerabilities.
- Production probes on 2026-07-16 show the redesign is **not deployed**. Hostinger serves the old `Apologia Sancta Live` shell: `/`, `/mobile/` and `/library/` return 200, while `/learn/`, `/practice/`, `/research/`, `/leaderboard/`, `/login/` and `/account/` return 404.
- Render Engine `/health`, `/rooms`, room state and the initial SSE snapshot return 200, but `/diagnostics` and `/rooms/global/stages` return 404, `/topics` returns zero authored topics, and gameplay uses the legacy fallback set. This is the old contract, not the reviewed Engine branch.
- Graph `/api/health` is 200, but browser deep routes return 404 and its counters advertise more content than the 13 records actually returned. The current Hostinger process does not match current Graph `main` behaviour.
