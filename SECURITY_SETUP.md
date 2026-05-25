# Security Setup — Apologia Sancta UI

## Environment Variables

### Required (server-side only — never expose to client)

| Variable | Description |
|---|---|
| `AUTHOR_ADMIN_PASSWORD` | Password for the `/author/login` page |
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

1. User must be logged in at `/author/login` (obtains `__Host-as_author_session` cookie).
2. Opening the drawer and pressing "Verify Session & Unlock" calls `GET /api/auth/csrf`.
3. If the session is valid, the drawer unlocks and all actions go through `/api/admin/*`.
4. An auto-lock timer (30 minutes) locks the drawer after inactivity.

---

## How Logout Works

`POST /api/auth/logout` clears both the session cookie and the CSRF cookie by setting them to an empty value with `Max-Age: 0` and `Expires: epoch`. No engine access is required. After logout the browser is redirected to `/author/login`.

Cookie names cleared:
- `__Host-as_author_session` (production) / `as_author_session` (development)
- `as_csrf_token`

The author dashboard calls this endpoint when the logout button is clicked, then immediately redirects to `/author/login`. Middleware will then deny any further access to `/author/*` until the user logs in again.

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
- Any hostname matching `*.hostingersite.com` (temporary preview domains)
- Any URL that is not a valid URL

### How to build a release APK

```bash
# 1. Set the production URL
export CAPACITOR_SERVER_URL=https://your-production-domain.com   # Unix
$env:CAPACITOR_SERVER_URL='https://your-production-domain.com'  # Windows PowerShell

# 2. Set build mode
export CAPACITOR_BUILD_MODE=production   # Unix
$env:CAPACITOR_BUILD_MODE='production'  # Windows PowerShell

# 3. Sync and build
npm run cap:sync
# Then open Android Studio and build a signed release APK
```

### Verify before building

Run `npx cap sync android` with `CAPACITOR_BUILD_MODE=production` set.  
If the URL is missing or invalid, the command exits immediately with a clear error before any files are written.

### Why temporary fallback URLs are not allowed

Previous versions of `capacitor.config.ts` fell back silently to a temporary Hostinger preview URL (`sandybrown-bear-488955.hostingersite.com`). This meant a release APK could accidentally point to an unstable host with no error. The hardened config makes this impossible in production mode.

---

## Production Checklist

- [ ] `AUTHOR_SESSION_SECRET` is set to a unique 32+ char random value
- [ ] `AUTHOR_ADMIN_PASSWORD` is set to a strong password
- [ ] `ENGINE_ADMIN_TOKEN` matches the engine's configured admin token
- [ ] `NEXT_PUBLIC_ENGINE_URL` points to the production engine URL
- [ ] `CAPACITOR_SERVER_URL` is set to the correct production HTTPS URL before building APK
- [ ] `CAPACITOR_BUILD_MODE=production` is set before running `cap sync` for a release build
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
AUTHOR_ADMIN_PASSWORD=devpassword
AUTHOR_SESSION_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ENGINE_ADMIN_TOKEN=dev-token
NEXT_PUBLIC_ENGINE_URL=http://localhost:3001
ENGINE_INTERNAL_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Cookies are `secure: false` in development (`NODE_ENV !== "production"`), so they work over HTTP.
The session cookie uses the plain name `as_author_session` in development (not `__Host-`).
