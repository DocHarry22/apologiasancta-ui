# Security Setup — Apologia Sancta UI

## Environment Variables

### Required (server-side only — never expose to client)

| Variable | Description |
|---|---|
| `ADMIN_EMAIL` | Bootstrap email for the first admin account |
| `ADMIN_PASSWORD` | Bootstrap password for the first admin account; stored only as a server-side hash |
| `DATABASE_URL` | MySQL/MariaDB connection string for admin users; alternatively use `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` |
| `AUTHOR_SESSION_SECRET` | Min 32-char random string used to HMAC-sign session and CSRF tokens |
| `ENGINE_ADMIN_TOKEN` | Token forwarded server-side to `x-admin-token` on the engine proxy |
| `ENGINE_INTERNAL_URL` | Internal (non-public) URL for the engine (used on server, not browser) |

### Public (safe to expose to client)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_ENGINE_URL` | Public engine URL — used by the browser to connect to SSE and public endpoints |
| `NEXT_PUBLIC_APP_URL` | Public UI URL — used by Capacitor and other places that need the app origin |

### APK / Capacitor build (build-time only)

| Variable | Description |
|---|---|
| `CAPACITOR_SERVER_URL` | Remote URL baked into the Android APK. **Must be a production HTTPS URL.** Takes priority over `NEXT_PUBLIC_APP_URL`. |
| `CAPACITOR_BUILD_MODE` | Set to `production` for release builds. Enables strict URL validation and rejects all unsafe URLs. Falls back to `NODE_ENV`, then `development`. |
| `NEXT_PUBLIC_ANDROID_APK_URL` | Public download URL shown on the homepage. Defaults to the latest GitHub release asset. |
| `APP_VERSION_CODE` | Positive integer Android `versionCode`; CI uses the GitHub run number. |
| `APP_VERSION_NAME` | User-visible Android version name, for example `1.0.1`. |
| `APKSIGN_KEYSTORE` | Local path to the release keystore file used by Gradle. |
| `APKSIGN_KEYSTORE_PASSWORD` | Password for the release keystore. |
| `APKSIGN_KEY_ALIAS` | Alias of the release key inside the keystore. |
| `APKSIGN_KEY_PASSWORD` | Password for the release key. |

---

## Generating Secrets

```bash
# AUTHOR_SESSION_SECRET (min 32 chars, random)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Cookie Architecture

| Cookie | httpOnly | sameSite | Scope |
|---|---|---|---|
| `__Host-as_author_session` (prod) / `as_author_session` (dev) | ✅ Yes | strict | Session auth — never readable by JS |
| `as_csrf_token` | ❌ No | strict | CSRF double-submit — readable by JS, echoed in `x-csrf-token` header |

The `__Host-` prefix in production enforces `Secure`, `Path=/`, and no `Domain` attribute.

---

## CSRF Protection

All admin mutation requests (`POST`, `PATCH`, `DELETE`) via `/api/admin/*` are protected by CSRF:

1. On login, the server sets `as_csrf_token` (non-httpOnly).
2. The browser reads this cookie and includes it as `x-csrf-token` header on all mutation requests (see `src/lib/adminProxyClient.ts`).
3. `src/lib/server/engineProxy.ts` verifies the header is a valid HMAC of the session value before proxying the request.
4. The CSRF token can be refreshed any time by calling `GET /api/auth/csrf`.

---

## Admin Mobile Panel

The mobile `AdminDrawer` no longer accepts an admin token. Unlock is session-based:

1. User must be logged in at `/admin/login` (obtains `__Host-as_author_session` cookie).
2. Opening the drawer and pressing "Verify Session & Unlock" calls `GET /api/auth/csrf`.
3. If the session is valid, the drawer unlocks and all actions go through `/api/admin/*`.
4. An auto-lock timer (30 minutes) locks the drawer after inactivity.

---

## How Logout Works

`POST /api/auth/logout` clears both the session cookie and the CSRF cookie by setting them to an empty value with `Max-Age: 0` and `Expires: epoch`. No engine access is required. After logout the browser is redirected to `/admin/login`.

Cookie names cleared:
- `__Host-as_author_session` (production) / `as_author_session` (development)
- `as_csrf_token`

The admin dashboard calls this endpoint when the logout button is clicked, then immediately redirects to `/admin/login`. Middleware will then deny any further access to `/admin/*` until the user logs in again.

---

## Capacitor Production Hardening

`capacitor.config.ts` enforces strict validation when `CAPACITOR_BUILD_MODE=production`.

### Build mode

| Mode | Behaviour |
|---|---|
| `development` (default) | Missing URL falls back to `http://localhost:3000` with a console warning. Cleartext HTTP allowed. |
| `production` | URL is **required**. Must use HTTPS. Forbidden hosts throw immediately, failing the build. |

The mode is read from `CAPACITOR_BUILD_MODE`, falling back to `NODE_ENV`, then `"development"`.

### Forbidden production URLs

The following are rejected with a hard error when `CAPACITOR_BUILD_MODE=production`:

- Missing URL (neither `CAPACITOR_SERVER_URL` nor `NEXT_PUBLIC_APP_URL` set)
- Any URL using `http://` instead of `https://`
- `localhost` as hostname
- `127.x.x.x` or `0.0.0.0`
- Any URL that is not a valid URL

### How to build a release APK

```bash
# 1. Set the production URL
export CAPACITOR_SERVER_URL=https://your-production-domain.com   # Unix
$env:CAPACITOR_SERVER_URL='https://your-production-domain.com'  # Windows PowerShell

# 2. Set build mode
export CAPACITOR_BUILD_MODE=production   # Unix
$env:CAPACITOR_BUILD_MODE='production'  # Windows PowerShell

# 3. Set signing and version metadata
$env:APKSIGN_KEYSTORE='C:\path\to\release-keystore.jks'
$env:APKSIGN_KEYSTORE_PASSWORD='replace-with-keystore-password'
$env:APKSIGN_KEY_ALIAS='replace-with-key-alias'
$env:APKSIGN_KEY_PASSWORD='replace-with-key-password'
$env:APP_VERSION_CODE='2'
$env:APP_VERSION_NAME='1.0.1'

# 4. Build the signed release APK
npm run apk:release
```

The release APK is copied to:

- `public/downloads/apologia-sancta.apk`
- `public/downloads/apologia-sancta-v<version>.apk`
- `../release-artifacts/apologia-sancta.apk`
- `../release-artifacts/apologia-sancta-v<version>.apk`

Release builds fail if signing variables are missing.

### GitHub latest APK link

The homepage uses `NEXT_PUBLIC_ANDROID_APK_URL` when configured. If it is not configured, it falls back to:

```text
https://github.com/DocHarry22/apologiasancta-ui/releases/latest/download/apologia-sancta.apk
```

The `.github/workflows/android-release.yml` workflow publishes that stable asset name on every Android release, so the home page always downloads the latest GitHub release APK.

Required GitHub secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Required GitHub variable:

- `CAPACITOR_SERVER_URL`

Recommended GitHub variable:

- `NEXT_PUBLIC_ENGINE_URL`

### Verify before building

Run `npx cap sync android` with `CAPACITOR_BUILD_MODE=production` set.  
If the URL is missing or invalid, the command exits immediately with a clear error before any files are written.

### Why silent fallback URLs are not allowed

Previous versions of `capacitor.config.ts` fell back silently to a temporary Hostinger preview URL (`sandybrown-bear-488955.hostingersite.com`). This meant a release APK could accidentally point to an unstable host with no error. The hardened config makes this impossible in production mode.

Hostinger URLs are allowed when they are explicitly configured through `CAPACITOR_SERVER_URL`, because that makes the release target intentional and visible in GitHub Actions.

---

## Production Checklist

- [ ] `AUTHOR_SESSION_SECRET` is set to a unique 32+ char random value
- [ ] `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set for first-admin bootstrap
- [ ] `DATABASE_URL` or Hostinger MySQL variables are configured for admin users
- [ ] `ENGINE_ADMIN_TOKEN` matches the engine's configured admin token
- [ ] `NEXT_PUBLIC_ENGINE_URL` points to the production engine URL
- [ ] `CAPACITOR_SERVER_URL` is set to the correct production HTTPS URL before building APK
- [ ] `CAPACITOR_BUILD_MODE=production` is set before running `cap sync` for a release build
- [ ] Android release signing secrets are configured before running the Android release workflow
- [ ] `NEXT_PUBLIC_ANDROID_APK_URL` points to the GitHub latest release asset or the production-hosted APK path
- [ ] HSTS header is served (enforced automatically in `next.config.ts` in production)
- [ ] CSP is reviewed — `connect-src` must include the engine URL
- [ ] Render / Hostinger have all required env vars configured

---

## Known Limitations

### In-memory rate limiting

`src/lib/auth/rateLimit.ts` uses an in-memory `Map` to track login attempts per IP. This works correctly for single-instance deployments but **is not production-grade for multi-instance or serverless deployments**: each instance has its own independent counter, so an attacker can bypass the limit by distributing requests across instances.

**Recommended fix for multi-instance production:** replace the in-memory implementation with one backed by Redis, Upstash KV, or another shared store that satisfies the `RateLimiter` interface exported from that module. No code changes are needed beyond swapping the implementation at the call site in `src/app/api/auth/login/route.ts`.

---

## Local Development

```env
ADMIN_EMAIL=admin@example.test
ADMIN_PASSWORD=devpassword
ADMIN_AUTH_MEMORY_STORE=true
AUTHOR_SESSION_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ENGINE_ADMIN_TOKEN=dev-token
NEXT_PUBLIC_ENGINE_URL=http://localhost:3001
ENGINE_INTERNAL_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Cookies are `secure: false` in development (`NODE_ENV !== "production"`), so they work over HTTP.
The session cookie uses the plain name `as_author_session` in development (not `__Host-`).
## Admin User Resolver

Roles are resolved server-side through `src/lib/server/currentUser.ts` and enforced for admin proxy calls in `src/lib/server/engineProxy.ts`. The browser receives the resolved role for UI filtering, but it is not trusted as authority for proxy access.

Admin users are database-backed through the `admin_users` table. `ADMIN_ROLE` controls only the bootstrap user role and defaults to `super_admin`. Do not move role authority into `localStorage`, query strings, or other browser-controlled state.
# Phase 4A Server-Side Enforcement

Workflow and audit routes require a valid author session. All workflow mutations require the existing `x-csrf-token` double-submit check and server-side permission checks.

Role authority remains server-side. Do not move roles, workflow approvals, audit events, or `ENGINE_ADMIN_TOKEN` into browser storage. Audit metadata is sanitized before persistence so session cookies, CSRF tokens, passwords, and admin tokens are redacted.
