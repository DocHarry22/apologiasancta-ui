# Apologia Sancta operational audit

Audit date: 2026-07-15

## System map

| Repository | Responsibility | Production target | Deployment control |
| --- | --- | --- | --- |
| `DocHarry22/apologiasancta-ui` | Next.js 16/React 19 web app, PWA, Android wrapper, public learning/library/live play, staff authentication, authoring and admin proxy | Hostinger: `https://sandybrown-bear-488955.hostingersite.com` | Hostinger project configuration must deploy `main`; this repository does not contain a Hostinger deployment action |
| `DocHarry22/apologiasancta-engine` | Express 5 REST/SSE game engine, rooms, controller, scoring, question bank, leaderboards and runtime persistence | Render: `https://apologiasancta-engine.onrender.com` | `render.yaml` tracks `main` with auto-deploy |
| UI repository (shared content/contracts) | 265+ question JSON records, content validation, API response types and learning content | Built into the UI; questions are also managed through the engine/admin workflow | Same as UI |

There is no active Supabase client or Supabase migration set. The engine uses PostgreSQL for atomic runtime snapshots in production. The UI can use PostgreSQL or MySQL for staff accounts, workflow records and audit data. Service-role credentials must never be exposed as `NEXT_PUBLIC_*` values.

## Flow audit

- Landing: existed primarily as an install/live entry page; now presents learn, practise, live competition and library clearly.
- Login/register: staff signup and login are role-aware and protected by server-side sessions, CSRF checks and rate limits. Player identity is intentionally lightweight, but is now bound to a signed room token.
- Learner dashboard: added as `/learn`, with device-local completion state and a structured four-lesson path.
- Host dashboard: existing `/admin` and `/author` consoles cover live controls, rooms, bank, authoring, review, topics and audit.
- Join/play: existing `/mobile` flow supports room switching, REST state snapshots, SSE reconnect and polling fallback. Joining now obtains a signed room session used for answer submission.
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
- Added source enforcement and regression coverage across the complete published question collection.
- Cleared lint warnings and verified both production builds.

### Risks that remain

- Player accounts are not durable authenticated learner accounts. Device progress and room identity are appropriate for MVP access, not prizes or paid competition.
- PostgreSQL persistence stores a durable engine snapshot, not a normalized analytics/leaderboard model. It remains a single-controller architecture and should not scale horizontally yet.
- Hostinger deployment ownership cannot be proven from repository configuration. A maintainer must confirm the Hostinger Git integration targets `main`, or deploy the merged commit manually.
- The full legacy question bank has references, but still requires an accountable human theological/editorial review before public endorsement.
- Android signing and store distribution still require the configured keystore secrets and a release rehearsal.

## Deployment blockers

Before merging/deploying, configure a new high-entropy `PLAYER_JOIN_SECRET` on Render. Deploy the engine before the UI so the signed-room contract is available. Then confirm Hostinger builds the Node/Next application from the same merged UI commit. See `docs/PRODUCTION_RUNBOOK.md`.

## Verification snapshot

- UI: ESLint pass; TypeScript pass; 27 tests pass; Next production build pass.
- Engine: TypeScript build pass; 16 tests pass, including room timing, duplicate prevention, signed tokens, CORS, persistence and diagnostics.
- Production probes during audit: Hostinger `/`, `/mobile/` and `/library/` returned 200; Render engine `/health` and `/rooms` returned 200; the separate Render UI URL returned 404 and is not the active frontend.

