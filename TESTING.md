# Testing

Apologia Sancta UI uses Vitest for unit/integration tests, React Testing Library for component and hook tests, and Playwright for browser E2E coverage.

## Commands

- `npm run test` runs the Vitest suite once.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run test:coverage` runs Vitest with coverage thresholds.
- `npm run test:e2e` runs Playwright browser tests.
- `npm run test:e2e:ui` opens the Playwright UI runner.
- `npm run verify` runs lint, typecheck, unit tests, and build.

Before deployment, run:

```bash
npm run lint
npm run types
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

## Test Environment

The test setup in `vitest.setup.ts` provides non-production test values:

- `AUTHOR_ADMIN_PASSWORD=test-author-password`
- `AUTHOR_SESSION_SECRET=test-session-secret-that-is-long-enough`
- `ENGINE_INTERNAL_URL=https://engine.test`
- `ENGINE_ADMIN_TOKEN=server-only-admin-token`

Do not use production credentials in automated tests.

## Auth And CSRF

Auth route tests call the route handlers directly and assert that login sets the author session cookie and readable CSRF cookie. CSRF route tests mock `next/headers` cookies so no browser session is needed.

Admin mutation tests generate a real signed session cookie and matching CSRF token, then verify that missing or invalid CSRF headers return `403`.

## Engine Mocking

Unit and route tests mock `fetch`; they never call the real engine. Playwright tests intercept `https://engine.test/**` and return fixture responses for `/health`, `/state`, and `/admin/*`.

The browser must never send `x-admin-token`. Tests assert that admin requests from the page do not include that header; the server proxy injects it only in the server-side engine request.

## Content Validation

`src/lib/contentTreeValidation.ts` validates `content/topics/index.json`, per-topic folders, `meta.json`, `manifest.json`, question files, choice fields, teaching content, tags, unique IDs, and filename-to-ID matching.

Run `npm run test -- src/lib/contentValidation.test.ts` when changing content.

## Security Headers

Playwright checks development-visible headers such as:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

Production-only headers such as HSTS and CSP should be inspected against a production build or preview deployment.
## Phase 3 Tests

Phase 3 adds a lightweight Node test script:

```bash
npm run test
```

The tests cover role permission helpers, question validation, workflow status transitions, topic validation, sequence validation, dangerous-action confirmation, and a static guard that browser admin/mobile files do not send `x-admin-token`.

## Phase 4 Mobile Tests

The Node test suite also covers mobile UX helpers for room query sanitization, onboarding state classification, phase copy, connection labels, and answer interaction locking.

Manual mobile QA should include `/mobile` at 360, 390, 412, and 430px widths. Confirm no permanent leaderboard rail appears below 520px, answer buttons are tap-friendly, the leaderboard opens as a drawer, and the admin drawer does not appear for ordinary production players unless `?admin=1` is present.
# Phase 4A Tests

`npm run test` includes `tests/phase4a.test.ts`, covering durable workflow store creation/listing/transitions, publish validation, workflow permission helpers, audit append/filter/redaction, current route enforcement structure, and browser-side token regression checks.

Manual dashboard verification should confirm that drafts and review actions survive page refresh and that the Audit tab shows persisted events or a clear unavailable state.
