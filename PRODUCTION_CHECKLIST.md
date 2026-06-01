# Production Checklist

## Verification

- [ ] `npm run lint` passes.
- [ ] `npm run types` passes.
- [ ] `npm run test` passes.
- [ ] `npm run test:coverage` runs and meets thresholds.
- [ ] `npm run build` passes.
- [ ] `npm run test:e2e` passes against the intended preview or local production build.

## Phase 1 Security Regression Checks

- [ ] `ENGINE_ADMIN_TOKEN` is configured server-side only.
- [ ] No admin token is present in browser JavaScript, `localStorage`, forms, or network request headers.
- [ ] Admin engine calls go through `/api/admin/*` proxy routes.
- [ ] Admin proxy allowlist rejects unknown routes with `404`.
- [ ] Admin proxy rejects wrong methods with `405`.
- [ ] Admin proxy rejects unsafe dynamic path segments with `400`.
- [ ] Unsafe admin mutations require a valid CSRF token.
- [ ] Logout clears the author session cookie and CSRF cookie.
- [ ] Admin mutation rate limiting and audit logging remain enabled.

## Environment

- [ ] `AUTHOR_ADMIN_PASSWORD` is set.
- [ ] `AUTHOR_SESSION_SECRET` is set to a strong secret.
- [ ] `ENGINE_INTERNAL_URL` points to the private/internal engine URL where available.
- [ ] `NEXT_PUBLIC_ENGINE_URL` points only to the public browser-safe engine origin.
- [ ] `ENGINE_ADMIN_TOKEN` is not prefixed with `NEXT_PUBLIC_`.
- [ ] No temporary tunnel, localhost, preview, or test URLs are used in production settings.

## App Readiness

- [ ] Capacitor production URL is configured correctly.
- [ ] Android release workflow has `CAPACITOR_SERVER_URL`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` configured.
- [ ] Latest Android release contains `apologia-sancta.apk` so the homepage download link resolves through GitHub Releases.
- [ ] Security headers are present on production responses.
- [ ] PWA manifest loads and install metadata is correct.
- [ ] `/author` redirects to `/author/login` when logged out.
- [ ] `/mobile` loads without requiring a real admin token.
- [ ] Content schema validation passes.
## Phase 3 Admin Dashboard Checklist

- Set `AUTHOR_DEFAULT_ROLE` explicitly in production. If unset, the transitional resolver falls back to `viewer`.
- Keep `AUTHOR_SESSION_SECRET`, CSRF, and server-side `ENGINE_ADMIN_TOKEN` configured. Do not expose admin tokens to browser code.
- Review role access before giving non-admin users the `/author` login password.
- Treat dashboard workflow drafts/reviews as local JSON-backed state until database storage lands.
- Configure database-backed audit storage before relying on the Audit section for compliance review.

## Phase 4 Mobile Checklist

- Verify `/mobile` at 360-430px widths before live use.
- Confirm `NEXT_PUBLIC_ENGINE_URL` points to the live engine and that `/events`, `/state`, `/answer`, `/register`, `/rooms`, and `/leaderboard` are reachable.
- Confirm the service worker does not cache live API traffic.
- Share room links as `/mobile?roomId=<room-id>`.
- Confirm production players do not see admin controls unless intentionally using `?admin=1`, and unlock still requires an author/admin session.
# Phase 4A Production Checklist

- Replace `.data/` JSON storage with a transactional database before multi-instance production.
- Configure backups and retention for workflow and audit data.
- Keep `AUTHOR_SESSION_SECRET`, `AUTHOR_PASSWORD_HASH`, and `ENGINE_ADMIN_TOKEN` server-side only.
- Verify workflow mutations require session, permission, and CSRF in deployment.
- Confirm published workflow items are either intentionally workflow-store-only or wired to the approved content publishing pipeline.
