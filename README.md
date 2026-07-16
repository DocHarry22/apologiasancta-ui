# Apologia Sancta UI

Next.js frontend for Apologia Sancta: a sourced Catholic formation, research, practice, and live quiz competition platform across web, PWA, and Android.

Built with Next.js 16, React 19, Tailwind CSS 4, and Capacitor 7.

Deployed on Hostinger: `https://sandybrown-bear-488955.hostingersite.com`
Android package: `com.apologiasancta.live`

## Operational platform update (July 2026)

This branch adds the sourced Foundations learning path, lesson progress, practice assessment, public leaderboard, fast room join, signed room sessions and production deployment hardening. The complete repository/deployment audit, founder-level roadmap and release procedure are maintained in:

- [Operational audit](./docs/OPERATIONAL_AUDIT.md)
- [Product roadmap](./docs/PRODUCT_ROADMAP.md)
- [Production runbook](./docs/PRODUCTION_RUNBOOK.md)
- [Unified product redesign](./docs/UNIFIED_REDESIGN.md)

The active frontend is the Hostinger Node/Next deployment. The old `apologiasancta-ui.onrender.com` service is not an active frontend. Merge-to-production depends on Hostinger's Git project being connected to `main`; see the runbook before release.

## Release-candidate state (July 2026)

The reviewed source now provides a unified responsive product across web, PWA, and Capacitor: an honest learner Home, a four-lesson sourced formation path, explanation-led practice, a searchable Library, a separate Research Graph gateway, real Engine leaderboards, secure account/staff access, and server-authoritative live rooms with reconnect support.

Production has deliberately not been changed by this branch. Release in this order:

1. Confirm the Hostinger Git project builds the reviewed UI commit as a Node/Next application, then deploy the dual-contract UI and smoke-test the current live Engine.
2. Configure a generated 32+ byte `PLAYER_JOIN_SECRET` and healthy PostgreSQL persistence on Render.
3. Deploy the hardened Engine commit and smoke-test registration, signed room joins, answer timing, duplicate rejection, SSE reconnect, results, and leaderboards.
4. Restart or redeploy the Graph Node process from its current `main` before advertising reliable deep links.

Remaining external gates are Hostinger branch ownership, the Render secret/persistence check, accountable theological review of legacy content, Android signing credentials, and a legal privacy policy. The repository must not be described as publicly launch-ready until those owner-controlled checks are complete.

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
| `/login` | Combined learner/staff sign-in and account creation |
| `/account` | Authenticated profile, progress, appearance, security, notifications, and privacy |
| `/privacy` | Public plain-language overview of current data handling and launch-policy limitations |
| `/learn` | Learner dashboard and structured apologetics path |
| `/learn/[lessonId]` | Sourced lesson page with objections and responses |
| `/practice` | Foundations practice assessment with explanations |
| `/leaderboard` | Public daily, weekly, and all-time rankings |
| `/dashboard` | Learner-dashboard compatibility redirect |
| `/mobile` | Mobile player experience |
| `/library` | Public topic library |
| `/library/[topicId]` | Topic detail page |
| `/research` | Internal gateway to the separate public Apologia Graph application |
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
