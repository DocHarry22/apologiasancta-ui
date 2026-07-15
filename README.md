# Apologia Sancta UI

Next.js frontend for Apologia Sancta Live, including the public landing page, room-aware mobile play experience, authoring dashboard, installable web app flow, and Android wrapper scaffolding.

Built with Next.js 16, React 19, Tailwind CSS 4, and Capacitor 7.

Deployed on Hostinger: `https://sandybrown-bear-488955.hostingersite.com`
Android package: `com.apologiasancta.live`

## Operational platform update (July 2026)

This branch adds the sourced Foundations learning path, lesson progress, practice assessment, public leaderboard, fast room join, signed room sessions and production deployment hardening. The complete repository/deployment audit, founder-level roadmap and release procedure are maintained in:

- [Operational audit](./docs/OPERATIONAL_AUDIT.md)
- [Product roadmap](./docs/PRODUCT_ROADMAP.md)
- [Production runbook](./docs/PRODUCTION_RUNBOOK.md)

The active frontend is the Hostinger Node/Next deployment. The old `apologiasancta-ui.onrender.com` service is not an active frontend. Merge-to-production depends on Hostinger's Git project being connected to `main`; see the runbook before release.

## Current State (v1 — June 2026)

The UI is deployed to Hostinger and the Android debug APK has been built and verified locally.

**What's working:**
- Room-aware mobile trivia flow with room switching while preserving global player identity
- Real-time SSE state updates with automatic reconnect and polling fallback
- Room and global leaderboard views driven by the engine's `daily`, `weekly`, and `all-time` windows
- Admin dashboard for content import, engine controls, persistence status, and room management
- Server-side admin proxy — the browser never receives the engine admin token
- CSRF double-submit cookie pattern protecting all admin proxy routes
- Security headers: HSTS, CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
- Installable PWA flow with manifest, generated app icons (all standard sizes), offline fallback page, and service-worker bypass for SSE/API traffic
- Android wrapper via Capacitor pointing at the deployed Hostinger URL
- Landing page install/download CTAs for Chromium browser install, iPhone Add to Home Screen, and Android APK distribution
- CI on GitHub Actions: lint, typecheck, unit tests, Next build, and Playwright E2E on every push; debug APK artifact on pushes to `main`, including auto-synced `apologia-sancta.apk` packaged filenames

**Known limitations / v1 gates not yet cleared:**
- Hostinger routes `/mobile/`, `/admin/login`, and `/library` currently return HTTP 403 — requires redeploying the latest build with the Apache `.htaccess` rewrite rule to Hostinger
- Engine route `/rooms/global/stages` returns HTTP 404 on the live Render deployment — requires redeploying the engine after the latest source is pushed to GitHub
- Signed APK release workflow is configured but not yet end-to-end verified (requires Android keystore secrets in GitHub Actions)
- APK is currently distributed only as an internal debug build; public signed release is gated on keystore setup

## Current Files And Deployment Status Snapshot (June 3, 2026)

- Workspace root is documentation-focused and not a git repository; source control is split between `apologiasancta-ui` and `apologiasancta-engine`
- UI repository currently contains active local edits across Android assets/config, workflows, mobile UI hooks/components, and deployment files
- Hostinger production root route `/` is expected up, but `/mobile/`, `/author/login`, and `/library` remain blocked until latest static export and `.htaccess` rewrites are redeployed
- Render engine APIs are generally up, but `/rooms/global/stages` remains blocked on the currently deployed engine build until redeploy from latest source
- Signed Android release is still pending GitHub Actions keystore secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`)

## Future Goals

- **Clear remaining v1 gates** — redeploy Hostinger static export with `.htaccess`, confirm all routes return HTTP 200, and ship signed APK to testers
- **Signed APK/AAB release pipeline** — set `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` in GitHub Actions secrets to enable automated signed release builds
- **Per-room topic flow in UI** — update room state display when the engine delivers independent per-room question tracks
- **Nonce-based CSP** — remove `unsafe-inline` from `script-src` once Next.js nonce support lands
- **Play Store submission** — migrate from debug to production-signed AAB and prepare store listing assets
- **Push notification support** — native push via Capacitor for round-start announcements to installed users
- **Offline queue** — buffer answer submissions locally when SSE is down and replay when reconnected

## Features

- Room-aware mobile trivia flow with room switching while preserving player identity
- Real-time SSE state updates with automatic reconnect and polling fallback
- Room and global leaderboard views driven by the engine's `daily`, `weekly`, and `all-time` windows
- Admin dashboard for content import, engine controls, persistence status, and room management
- Installable PWA flow with manifest, generated app icons, offline fallback, and service-worker registration
- Android wrapper scaffolding via Capacitor for shipping the web app inside a native shell
- Landing page install/download CTAs for browser install, iPhone Add to Home Screen, and Android APK distribution

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page with install/download actions |
| `/learn` | Learner dashboard and structured apologetics path |
| `/learn/[lessonId]` | Sourced lesson page with objections and responses |
| `/practice` | Foundations practice assessment with explanations |
| `/leaderboard` | Public daily, weekly, and all-time rankings |
| `/dashboard` | Learner-dashboard compatibility redirect |
| `/mobile` | Mobile player experience |
| `/library` | Public topic library |
| `/library/[topicId]` | Topic detail page |
| `/admin` | Protected admin and engine dashboard |
| `/admin/login` | Admin login |
| `/author` | Compatibility alias for the protected dashboard |
| `/author/login` | Compatibility alias for admin login |
| `/manifest.webmanifest` | PWA manifest route |
| `/offline` | Offline fallback page |

The `/admin` and `/author` areas are protected by middleware-backed session checks.

## Testing And Release Readiness

- See [TESTING.md](./TESTING.md) for unit, coverage, E2E, mocked engine, and security-header verification.
- See [SECURITY_SETUP.md](./SECURITY_SETUP.md) for Phase 1 security environment and deployment requirements.
- See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) before shipping a production build.

## Engine Compatibility

This UI is built for the room-aware engine release baseline:

- shared live topic progression across rooms
- room-scoped memberships, answers, scores, and leaderboard state
- room admin controls under `/admin/rooms/:roomId/*`
- paused restart recovery after engine restore

## Setup

### Prerequisites

- Node.js 18+
- npm
- A running `apologiasancta-engine` instance

### Installation

```bash
npm install
```

### Environment Variables

Create `.env.local` for local development:

```env
# Engine API base URL
NEXT_PUBLIC_ENGINE_URL=http://localhost:4000

# Optional public APK download link shown on the landing page
NEXT_PUBLIC_ANDROID_APK_URL=https://example.com/apologiasancta.apk

# Optional override for the public Apologia Graph deployment
NEXT_PUBLIC_RESEARCH_GRAPH_URL=https://mediumvioletred-kingfisher-797460.hostingersite.com

# Optional canonical web app URL used by Capacitor config fallback
NEXT_PUBLIC_APP_URL=https://apologiasancta.example.com
```

For Android shell builds, Capacitor also reads:

```env
CAPACITOR_SERVER_URL=https://your-deployed-ui.example.com
```

`CAPACITOR_SERVER_URL` overrides `NEXT_PUBLIC_APP_URL` in `capacitor.config.ts`.

### Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

## Install and Distribution

### Web app install

- Chromium-based browsers can install from the browser prompt or site install action
- Safari on iPhone can install through Add to Home Screen
- The app serves a manifest, app icons, and an offline fallback page for installability

### Android wrapper

The repository includes Capacitor scaffolding and a generated Android project.

```bash
# Sync web assets/config into Android
npm run cap:sync

# Copy the newest local APK into public/downloads and ../release-artifacts
npm run apk:sync

# Add Android platform if needed
npm run cap:add:android

# Open the Android project in Android Studio
npm run cap:open:android
```

The native shell points at the deployed web app URL configured by `CAPACITOR_SERVER_URL` or `NEXT_PUBLIC_APP_URL`.
When you update APK files locally, run `npm run apk:sync` before pushing so the latest APK filenames are refreshed for release packaging.

## Mobile Play Flow

1. Player opens `/mobile`.
2. UI resolves or registers a global player identity.
3. Player joins a room and receives room-scoped state.
4. SSE keeps the screen live; polling is used as fallback if the stream drops.
5. Answer, score, streak, rank, and leaderboard updates remain room-specific.

## Security Headers

Configured in `next.config.ts` via the Next.js `headers()` API. Applied to all routes.

### Headers applied on every response

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone, geolocation, payment, usb, interest-cohort all disabled |

### Production-only headers

| Header | Notes |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` — 2-year HSTS with preload. Not applied in development to avoid breaking HTTP local dev. |
| `Content-Security-Policy` | See below. Not applied in development so Next.js hot-reload and React DevTools are not broken by `unsafe-eval` restrictions. |

### Content Security Policy (production)

| Directive | Value | Reason |
|---|---|---|
| `default-src` | `'self'` | Restricts all unspecified resource types to same origin |
| `base-uri` | `'self'` | Prevents `<base>` tag injection attacks |
| `object-src` | `'none'` | Disables plugins (Flash, Java applets, etc.) |
| `connect-src` | `'self' <engine-origin>` | Allows SSE, REST polling, and fetch to same origin and the configured engine |
| `script-src` | `'self' 'unsafe-inline'` | `unsafe-inline` required by Next.js hydration bootstrap scripts |
| `style-src` | `'self' 'unsafe-inline'` | `unsafe-inline` required by Tailwind inline style injection |
| `img-src` | `'self' data: blob: https:` | Allows local, base64, blob, and remote HTTPS images |
| `font-src` | `'self' data:` | Allows local fonts and base64-embedded fonts in CSS |
| `manifest-src` | `'self'` | PWA manifest must be same-origin |
| `worker-src` | `'self' blob:` | Service worker registration from same origin |
| `form-action` | `'self'` | Form submissions restricted to same origin |
| `frame-ancestors` | `'none'` | Prevents clickjacking (equivalent to `X-Frame-Options: DENY`) |

### connect-src and the engine URL

`NEXT_PUBLIC_ENGINE_URL` origin is included in `connect-src` so the browser can open SSE connections to `/events` and poll `/state` on the engine. Only the **origin** (scheme + host + port) is extracted — the full path is not used.

`ENGINE_INTERNAL_URL` is **never** included in any browser-facing header. It is used only by the server-side admin proxy and never transmitted to the browser.

### CSP limitations

- `unsafe-inline` in `script-src` is required by Next.js inline hydration. This can be eliminated in a future phase by adopting nonce-based CSP via Next.js middleware.
- `unsafe-eval` is intentionally absent from production. If a dependency requires it, add it explicitly with a comment.
- CSP is skipped in development to avoid breaking hot-reload and React DevTools.

## Admin Proxy Security Architecture

### Overview

The admin dashboard communicates with the engine through a server-side proxy. The browser never holds or sends the engine admin token.

```
Browser (author session cookie)
  → POST /api/admin/start               (same-origin, no token)
      → Next.js route handler
          → verifyAdminSession()        (checks author session cookie)
          → CSRF token validation       (double-submit cookie pattern)
          → ADMIN_ROUTE_ALLOWLIST check (explicit route + method matching)
          → fetch(ENGINE_INTERNAL_URL/admin/start, { "x-admin-token": ... })
              → Engine                  (token injected server-side only)
```

### Environment variables

| Variable | Visibility | Purpose |
|---|---|---|
| `ENGINE_ADMIN_TOKEN` | Server-side only | Injected into every proxied admin request. Never sent to the browser. |
| `ENGINE_INTERNAL_URL` | Server-side only | Preferred internal engine URL for server-to-server calls. Falls back to `NEXT_PUBLIC_ENGINE_URL`. |
| `NEXT_PUBLIC_ENGINE_URL` | Public | Used by the browser for public SSE/health connections only. Must not contain secrets. |
| `NEXT_PUBLIC_RESEARCH_GRAPH_URL` | Public | Optional override for the public research workspace. Defaults to the deployed Hostinger Graph. |
| `AUTHOR_SESSION_SECRET` | Server-side only | Signs the author session cookie. |
| `DATABASE_URL` / `MYSQL_*` | Server-side only | Persists admin users, workflow drafts, audit events, invite settings, and legacy user records in PostgreSQL or MySQL. |
| `APP_STORAGE_DRIVER=file` | Server-side only | Optional local-development override that keeps application records in atomic `.data/` JSON files. |

### Admin proxy route allowlist

Only routes explicitly listed in `src/lib/server/engineProxy.ts` (`ADMIN_ROUTE_ALLOWLIST`) are forwarded to the engine. All other paths return `404`. Unknown methods return `405`. Invalid path segments (containing `../`, encoded slashes, or non-`[a-zA-Z0-9_-]` characters) return `400`.

Route pattern:
```
Internal:  GET  /api/admin/status
Engine:    GET  /admin/status

Internal:  POST /api/admin/start?roomId=abc
Engine:    POST /admin/rooms/abc/start      (path built from segment, not from query param)

Internal:  POST /api/admin/topic/start/romans?roomId=abc
Engine:    POST /admin/rooms/abc/topic/start/romans
```

To add a new admin endpoint, add an explicit `RouteRule` entry to `ADMIN_ROUTE_ALLOWLIST`.

### Session and CSRF protection

- All `/api/admin/*` routes require a valid author session cookie.
- Unauthenticated requests return `401` before any engine call is made.
- All mutation requests (non-GET) are rate-limited to 200 requests per 5-minute window per source IP (429 with `Retry-After` header on breach).
- All mutation requests (non-GET) require the CSRF token (`as_csrf_token` cookie echoed in `x-csrf-token` header) using the double-submit pattern.

### Admin audit logging

Every request handled by the admin proxy emits a structured JSON log entry to stdout:

```json
{ "t": "2025-01-01T00:00:00.000Z", "domain": "admin_proxy", "method": "POST", "path": "start", "ip": "1.2.3.4", "outcome": "allowed", "statusCode": 200 }
```

Possible outcomes: `allowed`, `blocked_unauthed`, `blocked_rate_limit`, `blocked_csrf`, `blocked_allowlist`, `proxy_error`.

These entries are captured by the host platform's log aggregator (Render, Railway, etc.) and can be filtered by `domain: admin_proxy`.

### Mobile admin panel

The mobile admin drawer (`src/components/mobile/AdminDrawer.tsx`) uses session-based unlock (same `/api/auth/csrf` check as the desktop dashboard). It does not ask for or store an engine admin token.

### Removed: browser token flow

Prior to Phase 1.1, the browser stored `adminToken` in `localStorage` and sent `x-admin-token` directly to the engine. This flow has been removed. All admin calls now go through the server-side proxy.

The legacy token-accepting functions in `src/lib/engineAdmin.ts` (`engineFetch`, `adminActions`, `roomActions`, `contentActions`, `quizActions`, `topicActions`) are dead code and marked `@deprecated`. They are not called by any browser component and will be removed in a future cleanup.

## Author Dashboard

The author dashboard supports:

- content batch import and JSON preview
- engine health and persistence visibility
- room creation and room closing
- room-scoped start, pause, resume, next, reset, and topic controls
- topic-sequence and countdown management

## Key Components

### Mobile UI

| Area | Purpose |
|------|---------|
| `src/components/mobile` | Player HUD, answers, leaderboard, ticker, admin drawer |
| `src/hooks/useQuizSSE.ts` | SSE lifecycle, reconnects, and polling fallback |
| `src/hooks/useLocalPlayer.ts` | Local identity persistence |
| `src/hooks/useLeaderboardDiff.ts` | Leaderboard change animation support |

### Authoring and engine control

| Area | Purpose |
|------|---------|
| `src/components/author` | Dashboard, import, engine control, JSON preview |
| `src/lib/engineAdmin.ts` | Client wrapper for engine and room admin endpoints |
| `middleware.ts` | Session gate for `/author` routes |

### Installability

| Area | Purpose |
|------|---------|
| `src/components/pwa` | Service worker registration |
| `public/app-icons` | Generated install icons |
| `capacitor.config.ts` | Android shell configuration |

## Development

```bash
# Local development
npm run dev

# Linting
npm run lint

# Production verification
npm run build
```

## Project Structure

```
src/
├── app/                  # Next app routes, pages, and API routes
├── components/           # Author, library, mobile, UI, and PWA components
├── hooks/                # Player, SSE, and animation hooks
├── lib/                  # Engine API clients, content helpers, auth, theme
├── types/                # Shared frontend types
└── content/              # Topic content consumed by the UI

android/                  # Capacitor Android project
public/                   # Static assets
```

## License

Private

## Phase 3 Admin Dashboard

`/admin` is now the primary role-aware admin dashboard for overview, live control, rooms, question bank, authoring, review, topics, audit visibility, and settings. `/author` remains a compatibility alias. Roles and permissions are centralized in `src/lib/auth/roles.ts`; the server-side user resolver is `src/lib/server/currentUser.ts`.

Configure `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTHOR_SESSION_SECRET`, and a PostgreSQL or Hostinger-compatible MySQL connection through `DATABASE_URL` or `MYSQL_*` variables. The same database now stores admin users, authoring workflow state, audit history, invite settings, and transitional user records. See `ADMIN_DASHBOARD.md` for the full role matrix, workflow behavior, and dangerous action UX.

## Phase 4 Mobile UX

`/mobile` is now phone-first with compact onboarding, room search/copy links, query-string room joins, clear OPEN/LOCKED/REVEAL phase states, submitted-answer locking, drawer-based leaderboards, expandable teaching moments, and user-friendly reconnect/polling/offline states.

See `MOBILE_UX.md` for route states, gameplay behavior, PWA caching, and mobile admin drawer rules.
# Phase 4A Durable Workflow Foundation

Phase 4A uses a shared persistence abstraction for workflow items, audit events, invite settings, and the transitional current user. Production automatically uses the configured PostgreSQL/MySQL database; local development retains atomic JSON storage under `.data/`. See `PERSISTENCE.md` for deployment and migration behavior.

New internal routes include `/api/auth/me`, `/api/workflow/items`, workflow transition routes, and `/api/audit/events`. Browser components continue to call only same-origin API routes and never send engine admin tokens.
