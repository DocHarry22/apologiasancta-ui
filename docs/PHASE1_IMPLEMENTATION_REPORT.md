# Phase 1 implementation report

Prepared: 2026-07-17
Scope: learning-platform structure, storage, functionality, and integration foundation
Implementation branches: `codex/phase1-learning-platform` in the UI and Engine repositories

## Completion status

The repository-local Phase 1 foundation is implemented and its database, API, and Engine core paths have automated coverage. Phase 1 is **not yet a production deployment** and does **not yet satisfy the deployment-dependent acceptance criteria**. In particular:

- The migration has been validated only in a disposable PostgreSQL 16 environment. It has not been applied to a hosted Supabase project.
- The Supabase project available during this work, `rgfloeshqjbjfdarwdxn`, contained unrelated commerce/water/maintenance objects and was deliberately not modified.
- No Hostinger UI deployment, Render Engine deployment, production database backup, production migration, or production content mutation was performed.
- The available Hostinger integration did not provide a deployment path for the existing Git-backed Next.js application, and no live Render deployment connector was available in this task.
- The Apologia Graph repository was inspected only; no Phase 1 Graph source change is included.

The safe next state is a draft PR plus a controlled staging rollout against a verified, dedicated Apologia Supabase project. Production promotion still requires explicit approval.

## 1. Architecture implemented

The implementation preserves the established Next.js App Router, React/TypeScript, Express 5, REST/SSE, Hostinger, Render, PWA, and Capacitor shape.

The target data flow is:

1. Supabase/PostgreSQL owns canonical learning content, publication state, learner progress, mastery state, and the durable live-game schema.
2. The Next.js server reads PostgreSQL through the server-only `LEARNING_DATABASE_URL` and exposes versioned, validated API contracts. Browser and Android clients do not receive database credentials.
3. Public routes read only explicit `content.published_*` views. Learner mutations use owner-scoped APIs and transactional database functions.
4. Official mastery starts and submits through database RPCs that snapshot question versions, score server-side, update progress, and recompute unlocks in one transaction.
5. The Express Engine conditionally fetches a bearer-protected live-question feed from the UI, validates the complete feed, atomically swaps its cache, and retains REST/SSE room behavior.
6. The PWA caches published catalogue/lesson reads and queues only safe lesson-progress writes. Offline activity never grants mastery or unlocks.

Logical database ownership is separated into `content`, `public`, `game`, and non-exposed `private` schemas. GitHub contains source, migrations, tests, neutral fixtures, and transfer tooling; it is not the runtime content database. Hostinger remains the intended UI host and Render remains the intended Engine host.

This architecture becomes operational only after the migration and environment configuration are applied to the correct hosted systems.

## 2. Repositories inspected

| Repository | Audit result | Phase 1 change status |
| --- | --- | --- |
| `DocHarry22/apologiasancta-ui` | Inspected Next.js routes, auth boundaries, admin/author surfaces, bundled content, local progress, PWA, Capacitor, deployment examples, tests, and existing operational documentation. The legacy inventory found 22 topics, 265 questions, and 595 source-reference occurrences. | UI, API, schema, migration, PWA, and documentation changes are present in the feature worktree. |
| `DocHarry22/apologiasancta-engine` | Inspected Express routes, REST/SSE flow, content loading, room persistence, restart behavior, admin authentication, Render blueprint, and verification tests. | Canonical feed, fail-closed runtime, diagnostics, security, and tests are present in the feature worktree. |
| `DocHarry22/apologia-graph` | Inspected as the existing research/argument application and optional relationship target. | Audit-only. No Phase 1 Graph source file is in the implementation diff. |

Recorded deployment endpoints were:

- UI: `https://sandybrown-bear-488955.hostingersite.com`
- Engine: `https://apologiasancta-engine.onrender.com`
- Graph: `https://mediumvioletred-kingfisher-797460.hostingersite.com`

Read-only production baseline checks on 2026-07-17 returned:

- UI `/`: `200`
- UI `/learn`: `200`
- UI `/manifest.webmanifest`: `200`
- UI `/api/v1/learning/programmes`: `404`, confirming that the new versioned learning API is not deployed
- Engine `/health`: `200`, reporting healthy PostgreSQL persistence
- Engine `/state`: `200`
- Engine protected canonical admin status: `401` without an admin credential, confirming that the admin boundary is closed to anonymous requests
- Graph `/`: `200`

The connected Supabase project was also inspected before any mutation. Its unrelated schema made it an unsafe target, so hosted database work stopped at that boundary.

## 3. Branches used

| Repository | Branch/worktree | Starting revision |
| --- | --- | --- |
| UI | `codex/phase1-learning-platform` in `apologiasancta-ui-phase1-learning` | `origin/main` at `aa79796` |
| Engine | `codex/phase1-learning-platform` in `apologiasancta-engine-phase1-learning` | `origin/main` at `bddbc38` |
| Graph | Existing audit worktree on `hotfix/hostinger-build-artifact` | `283998e`; no Phase 1 diff |

No direct change to `main` and no production deployment was made. At the time this report was drafted, implementation changes were still local working-tree changes and had not been merged. The GitHub CLI was not authenticated, so commit/push/draft-PR publication could not be completed from this environment.

## 4. Database schemas and tables added or changed

### `content` schema

The migration creates:

- Hierarchy: `programmes`, `subjects`, `learning_groups`, `lessons`, `lesson_sections`, `learning_objectives`.
- Prerequisites: `programme_prerequisites`, `subject_prerequisites`, `group_prerequisites`, `lesson_prerequisites`.
- Canonical question bank: `questions`, `question_options`, `question_contexts`.
- Sources and relationships: `sources`, `content_sources`, `content_relationships`.
- Governance: `content_versions`, `audit_log`.

Publication, review, visibility, prerequisite, structured-block, entity, question-type, question-context, and retirement enums enforce the shared vocabulary. Cycle guards, hierarchy checks, publication checks, no-delete-after-publication rules, context-separation checks, version checks, ordering constraints, and indexes are defined in the database.

Safe views include published hierarchy, lesson sections/objectives, sources, prerequisites, relationships, catalogue/search data, public-practice question data, a service-only live feed, and a service-only invalid-live-configuration diagnostic. Published views contain explicit visibility predicates in addition to RLS so owner-bypass connections cannot accidentally expose drafts.

### `public` schema

The migration creates:

- `learner_profiles`
- `lesson_progress`
- `bookmarks`
- `mastery_attempts`
- `mastery_attempt_questions`
- `mastery_answers`
- `unlocks`
- `group_progress`
- `review_schedule`
- `question_metrics`
- authenticated, owner-filtered `review_recommendations` view

`public.start_mastery_attempt` and `public.submit_mastery_attempt` delegate to private security-definer implementations. They enforce ownership, idempotency, immutable scoring snapshots, server-side scoring, transactional progress, prerequisite recomputation, successful/failed unlock behavior, metrics, review scheduling, and audit records.

### `game` schema

The migration creates the durable normalization target:

- `rooms`
- `room_participants`
- `sessions`
- `session_questions`
- `player_answers`
- `leaderboard_entries`

These tables remain separate from official learning mastery. The current Render runtime continues to control live room timing and can migrate its persistence incrementally.

### `private` and staff storage

The `private` schema contains internal authorization, validation, audit, prerequisite, and mastery functions and is not intended for the Data API. The UI staff-user store now supports a configurable private schema (`ADMIN_DB_SCHEMA`, default `private`), disables production bootstrap unless explicitly enabled, revokes broad access, and retains a guarded compatibility path from the former public table.

No Supabase Storage bucket or policy was created. Asset columns can reference an approved storage path/URL, but bucket-specific rights await an asset and licensing policy.

## 5. Migrations created

| File | Purpose |
| --- | --- |
| `supabase/migrations/20260717175144_phase1_learning_foundation.sql` | Reversible Phase 1 schema, constraints, indexes, views, RLS/grants, audit triggers, and mastery RPCs. |
| `supabase/rollback/20260717175144_phase1_learning_foundation.down.sql` | Drops only the Phase 1 objects; destructive to all Phase 1 data and therefore backup-gated. |
| `supabase/fixtures/phase1_minimal.sql` | Idempotent neutral non-production fixture, including a valid four-option live question and separate practice-only coverage. |
| `supabase/tests/plain_postgres_bootstrap.sql` | Test-only Supabase role/auth stubs for disposable plain PostgreSQL; never deploy this file to Supabase. |
| `supabase/tests/phase1_foundation_test.sql` | Functional, integrity, mastery, replay, prerequisite, unlock, metrics, and live-feed tests. |
| `supabase/tests/phase1_security_catalog_test.sql` | RLS, grants, safe-view, owner-bypass, answer-key, and security-catalog tests. |
| `supabase/scripts/export_phase1_content.sql` | Canonical content export without learner/game/audit data. |

The migration, fixture applied twice, functional tests, security tests, export, and rollback were exercised in disposable PostgreSQL 16. The rollback check left none of the Phase 1 custom schemas/objects behind. No hosted migration was attempted.

The offline transfer utility inventories, transforms, validates, exports, and generates transactional idempotent SQL without opening a database connection. Its legacy test transform produced one staging programme, 22 subjects, 22 groups, 265 questions, 1,060 options, 494 deduplicated sources, and 595 source links; a repeat run produced stable identities. Imported legacy content remains hidden, draft, unreviewed, and context-free until human editorial, theological, and rights review.

## 6. API routes added or changed

### Public learning API

- `GET /api/v1/learning/programmes`
- `GET /api/v1/learning/programmes/[slug]`
- `GET /api/v1/learning/subjects/[slug]`
- `GET /api/v1/learning/groups/[slug]`
- `GET /api/v1/learning/lessons/[slug]`
- `GET /api/v1/learning/search`
- `GET /api/v1/learning/practice`
- `POST /api/v1/learning/practice/check`
- `GET /api/v1/learning/progress/preview`

Public responses are paginated where appropriate, use explicit output serialization, and read safe published views. Practice retrieval excludes answer flags and is limited to supported public-practice question types. Practice checking revalidates the question through the published view.

### Authenticated learner API

- `GET /api/v1/learning/progress`
- `PUT /api/v1/learning/lessons/[lesson-id]/progress`
- `GET|POST|DELETE /api/v1/learning/bookmarks`
- `GET|POST /api/v1/learning/mastery/attempts`
- `POST /api/v1/learning/mastery/attempts/[id]/submit`
- `GET /api/v1/learning/unlocks`
- `GET /api/v1/learning/recommendations`

### Staff learning API

- `GET|POST /api/v1/admin/learning/[entity]`
- `GET|PATCH|PUT|DELETE /api/v1/admin/learning/[entity]/[id]`
- `POST /api/v1/admin/learning/[entity]/[id]/[action]`
- `POST /api/v1/admin/learning/workflow/[id]/[action]`
- `POST /api/v1/admin/learning/[entity]/reorder`
- `POST /api/v1/admin/learning/[entity]/import`
- `GET /api/v1/admin/learning/[entity]/export`
- `GET /api/v1/admin/learning/calendar`

The generic contracts cover programmes, subjects, groups, lessons, sections, objectives, questions, options, contexts, sources, content-source links, prerequisites, workflow queue, and audit data. Workflow actions are submit, request changes, approve, publish, schedule, archive, restore, duplicate, and create-new-version.

### Engine API and proxy changes

- `GET /api/v1/engine/questions` is a server-to-server bearer-protected feed with ETag/304 support.
- The existing UI Engine proxy allowlist now permits only the required canonical status and refresh operations in addition to existing authorized operations.
- Engine additions are `POST /admin/content/refresh` and `GET /admin/content/canonical/status`; existing health, diagnostics, state, rooms, events, answer, and content endpoints were hardened for required-canonical mode.

## 7. Public pages added or changed

Added database-backed routes:

- `/learn`
- `/learn/programmes/[programmeSlug]`
- `/learn/subjects/[subjectSlug]`
- `/learn/groups/[groupSlug]`
- `/learn/groups/[groupSlug]/mastery`
- `/learn/[lessonId]`
- `/learn/search`
- `/practice`

The reusable learning component supplies catalogue loading/empty/error states, configurable hierarchy navigation, locked/unlocked presentation, structured lesson blocks, sources, previous/next navigation, mark-as-complete, account-linked lesson bookmark save/remove, official mastery flow, permitted post-submit results, practice checking, and published-content search. Home and Account surfaces now request official server progress, while bundled hard-coded learning content was removed from the library/account/sitemap paths.

The server contract supports resume locators and bookmarks. Continuous reading-position capture, every rich block variant, and complete browser-level coverage still require staging/manual validation; these are not claimed as production-verified here.

## 8. Admin pages added or changed

Added:

- `/admin/learning`
- `/author/learning`
- learning entry in the existing author sidebar/dashboard
- reusable `LearningCms` within the established staff-session application

The CMS implements entity tabs, create/edit forms, validation, status filters, loading/empty/error states, unsaved-change protection, confirmations, drag/drop ordering, import/export, review queue, publication calendar, audit list, workflow actions, archive/restore, duplicate, new version, and responsive/dark-theme-compatible controls. Roles and permissions were extended for Editor, Contributor, and Member while retaining existing compatibility roles.

This is the structural CMS foundation. Dedicated revision comparison, unpublished-content preview rendering, fully populated question-usage analytics, and computed broken-reference/licence-warning inspectors are not yet proven end to end and remain follow-up work before production editorial use.

## 9. Engine integration changes

The Engine now has a canonical feed client that:

- uses `CONTENT_API_URL` and a server-only bearer token;
- supports ETag and `304 Not Modified`;
- accepts the UI envelope or protected PostgREST-style rows;
- validates size, timeout, redirects, JSON shape, unique IDs, exactly one correct answer, supported types, versions, digests, and status contradictions;
- rejects version regressions and same-version content changes;
- atomically replaces the validated bank;
- persists non-secret feed metadata and canonical provenance;
- retains immutable active-room question revisions during ordinary refreshes;
- provides periodic and admin-triggered refresh;
- reports fresh/stale/unavailable state in health and diagnostics.

When `CONTENT_API_REQUIRED=true`, cold starts without a validated canonical feed/cache fail closed. Legacy import, GitHub sync/delete, local clear, and quiz-set mutation paths return `409 canonical_content_required`; non-canonical persisted pools are purged; rooms/state/SSE/start/answer paths return unavailable instead of falling back to bundled content. A canonical refresh can recover the service. Optional mode retains legacy development behavior.

REST, SSE, guest participation, account identity, continuous rotation, rooms, leaderboards, and reveal timing remain in place. The changes have not been exercised against the production Hostinger feed or deployed to Render.

## 10. Capacitor/PWA changes

`public/sw.js` now versions the learning cache, caches the published catalogue and recently read lesson/API responses, and keeps network-first behavior where freshness matters. IndexedDB queues only safe lesson-progress `PUT` events for later synchronization. Mastery starts/submissions and unlocks are never queued or granted offline.

The learning UI labels official mastery as online/server-confirmed, exposes live quiz navigation from the learning surface, and uses responsive, theme-compatible controls. The Android wrapper continues to consume the hosted Next.js application via `CAPACITOR_SERVER_URL`, so it will use the same API after deployment.

No server secret was added to client or Capacitor configuration. `npm run cap:sync` completed successfully and detected three plugins, but the task environment did not supply an application URL and the OneDrive/sibling-junction layout caused generated Android paths to reference the sibling worktree. Those generated changes were restored exactly. Production or local installation must regenerate them with the intended `CAPACITOR_SERVER_URL` in a normal checkout. A production APK was not produced.

## 11. Security controls

- Explicit RLS policies and least-privilege grants for published content and owner-scoped learner data.
- `security_invoker` published views plus explicit status/date/visibility predicates to protect owner-bypass server connections.
- Service-only live feed and invalid-live-config view; answer keys excluded from public/practice and initial mastery payloads.
- Transactional security-definer mastery functions with ownership checks, immutable scoring snapshots, idempotency, replay/payload checks, and server-only unlock decisions.
- Public-practice and official-mastery context overlap rejected by a deferred database constraint trigger.
- Staff access remains behind the existing protected staff session; learner/member sessions do not grant `/admin/*` access.
- Server-side role/permission checks, author ownership limits, and self-review prevention.
- CSRF checks on authenticated mutations, mutation rate limiting, bounded pagination/imports, UUID/slug/body validation, and structured error envelopes.
- Dedicated server-only `LEARNING_DATABASE_URL`, Engine admin token, content-feed token, and session/join/identity secrets; no service-role or feed credential is exposed through `NEXT_PUBLIC_*`.
- Content feed and Engine admin credentials reject missing, short, and documented placeholder values; comparison is timing-safe where applicable.
- Private-schema staff storage, production bootstrap opt-in only, and explicit revocation from broad database roles.
- Required-canonical Engine mode fails closed and prevents alternate writable content sources from becoming a competing source of truth.
- Existing explicit CORS origin configuration and server-side Engine proxy boundaries are preserved.

These controls are code- and database-test results. Hosted policies, secret rotation, TLS, CORS origins, and least-privilege database credentials still require verification in the real staging/production environments.

## 12. Tests executed

| Area | Execution | Result |
| --- | --- | --- |
| PostgreSQL migration | Clean apply on disposable PostgreSQL 16 | Passed. |
| Fixture | Applied twice | Passed; idempotent. |
| Database functional suite | `phase1_foundation_test.sql` | Passed, including FK/cycles, publication, scoring, replay, successful/failed unlock, multiple prerequisites, metrics, and live feed. |
| Database security suite | `phase1_security_catalog_test.sql` | Passed, including RLS/grants, owner bypass, public exclusion, and answer-key controls. |
| Export and rollback | Canonical export followed by down migration | Passed; Phase 1 objects removed. |
| Legacy transfer | Inventory, transform, validate, import SQL, and repeat-idempotency checks | Passed for 22 topics / 265 questions; rights review intentionally unresolved. |
| UI Vitest | `npm run test:vitest` | Passed on final rerun: 36 files, 160 tests, exit `0` (including the bookmark component). |
| Bookmark component | Focused Vitest for `src/components/learn/LearningPlatform.test.tsx` | Passed: 1/1 test, covering account-linked save and precise ID-based removal; related typecheck/lint/diff checks also passed. |
| UI Node suite | `npm test` | Passed: 37/37 tests; batch-import utility internal checks 27/0. Only Node module-type reparsing warnings were emitted. |
| UI type check | `npm run typecheck` | Passed after the bookmark addition. |
| UI production build | Exact source copied outside OneDrive; `next build --webpack` | Passed: compiled in 79s, completed Next's TypeScript phase in 17.2s, and generated 43/43 static pages. |
| Engine build/tests | `npm run build`; `npm test` | Passed on rerun: TypeScript build and 50/50 tests. |
| Service worker syntax | `node --check public/sw.js` | Passed. |
| Patch hygiene | `git diff --check` in UI and Engine | Passed; line-ending conversion warnings are informational. |
| Capacitor sync | `npm run cap:sync` | Exited `0` and detected three plugins. Environment warning: no app URL was supplied and generated paths followed sibling junctions; generated Android changes were restored rather than retained. |

The full browser E2E matrix, manual CMS workflow, deployed Supabase RLS verification, production live-room test, and APK runtime test were not executed. Lint/build/Capacitor results are stated separately below so a partial result is not mistaken for full acceptance.

## 13. Build results

- Engine TypeScript production build: **passed**.
- UI TypeScript check: **passed** after the final UI addition.
- UI production Next.js build: **passed** from an exact temporary source copy outside OneDrive using `next build --webpack`. Next compiled successfully in 79 seconds, completed its TypeScript phase in 17.2 seconds, generated 43/43 static pages in 10.2 seconds, finalized optimization, and exited `0`. The ordinary `npm run build` in the feature worktree did not reach compilation because Turbopack rejected its intentionally shared `node_modules` junction, and an initial Webpack attempt inside OneDrive timed out during type checking. The isolated build removes those environment artifacts and is the source-code production-build verdict.
- UI changed-source lint: **passed** after the bookmark addition across 71 changed JavaScript/TypeScript files with 0 errors and 0 warnings. A whole-repository lint attempt did not complete in the OneDrive worktree and is not claimed as passed.
- PWA service-worker syntax: **passed**.
- Capacitor sync tooling: **exited successfully**, with the environment/path qualification described above. Generated Android changes were restored; no APK is claimed.

The UI and Engine production builds are clean. A configured Android package/runtime test was not available, so Capacitor is accepted only at the verified-sync level permitted by the master prompt; no APK is claimed.

## 14. Deployment results

| Target | Result |
| --- | --- |
| Supabase/PostgreSQL | Not deployed. The connected project was unrelated and unsafe. No backup or migration was attempted against it. |
| Render Engine | Not deployed. `render.yaml` and environment documentation are prepared; `autoDeploy` is disabled for explicit promotion. No live connector/deploy action was available. |
| Hostinger UI | Not deployed. The available Hostinger surface did not support deploying this existing Git-backed Next.js repository. |
| PWA/Android | Not released. No production service-worker or APK/AAB was published. |
| GitHub | Feature worktrees were prepared. The CLI was not authenticated, so commit, push, and draft PR creation were blocked. No direct production branch push or merge occurred. |
| Apologia Graph | No deployment and no source change. |

Consequently, the live URLs remain the pre-existing deployments and cannot yet demonstrate the database-backed Phase 1 architecture. The read-only baseline remained reachable (UI, Engine, and Graph roots `200`; Engine persistence healthy), while the UI's new `/api/v1/learning/programmes` route returned `404` as expected for undeployed code. Production health and full web/mobile/live-quiz flows must be rechecked after a controlled staging deployment and explicit production promotion.

## 15. Files changed

### UI repository

- Environment/runtime: `.env.example`, `env.production.example`, `public/sw.js`.
- Database: `supabase/migrations/20260717175144_phase1_learning_foundation.sql`, `supabase/rollback/20260717175144_phase1_learning_foundation.down.sql`, `supabase/fixtures/phase1_minimal.sql`, `supabase/scripts/export_phase1_content.sql`, and the three files under `supabase/tests/`.
- Transfer/docs: `scripts/phase1-content-transfer.mjs`, `docs/PHASE1_SCHEMA_FOUNDATION.md`, `docs/PHASE1_SCHEMA_MAPPING.md`, `docs/PHASE1_CONTENT_TRANSFER.md`, and this report.
- Versioned API: all routes under `src/app/api/v1/learning/`, `src/app/api/v1/admin/learning/`, and `src/app/api/v1/engine/questions/`.
- API implementation/tests: `src/lib/learning/*` and `src/lib/server/learning/*`.
- Public learning UI: `src/components/learn/LearningPlatform.tsx`; learning programme/subject/group/mastery/search/lesson pages under `src/app/learn/`; `src/app/practice/page.tsx`.
- CMS: `src/components/author/LearningCms.tsx`, `src/app/admin/learning/page.tsx`, `src/app/author/learning/page.tsx`, `src/app/author/AuthorSidebar.tsx`, and `src/components/author/AuthorDashboardClient.tsx`.
- Existing surface integration: account, library, home, sitemap, role/access/current-user/invite code, staff database store, Engine proxy, and its admin-route test.

### Engine repository

- Canonical feed/security: `src/content/canonical.ts`, `src/security/adminToken.ts`, `src/canonicalContent.verification.test.ts`, and `docs/CANONICAL_CONTENT_FEED.md`.
- Runtime integration: `src/content/bank.ts`, `src/content/github.ts`, `src/engine/roundController.ts`, `src/index.ts`, and content/admin/answer/diagnostics/events/health/rooms/state routes.
- Validation/configuration: deployment/runtime tests, test support, `.env.example`, `env.production.example`, `README.md`, `package.json`, and `render.yaml`.

### Graph repository

No Phase 1 file was changed.

## 16. Environment variables required

Real values belong in Hostinger/Render/Supabase secret configuration, never in Git.

### UI / Hostinger server

| Variable | Requirement |
| --- | --- |
| `LEARNING_DATABASE_URL` | Dedicated Apologia Supabase/PostgreSQL server connection string. Required for learning APIs. |
| `LEARNING_DB_SSL_MODE` | Normally `require` for hosted PostgreSQL. |
| `LEARNING_DB_CONNECT_TIMEOUT_MS` | Bounded database connection timeout. |
| `LEARNING_DB_STATEMENT_TIMEOUT_MS` | Bounded database statement timeout. |
| `CONTENT_API_TOKEN` | 32+ byte independent random bearer token shared only with the Engine. |
| `ENGINE_INTERNAL_URL` | HTTPS Render Engine origin for server proxy calls. |
| `ENGINE_ADMIN_TOKEN` | Server-only Engine admin credential; independent from the feed token. |
| `DATABASE_URL` | Existing staff/workflow database connection where applicable. Do not point it at an unrelated schema without review. |
| `ADMIN_DB_SCHEMA` | `private` by default. |
| `ADMIN_BOOTSTRAP_ENABLED` | `false` except during a controlled first provisioning step. |
| `AUTHOR_SESSION_SECRET` | Existing 32+ byte staff-session signing secret. |
| `NEXT_PUBLIC_APP_URL` | Public Hostinger application origin. |
| `NEXT_PUBLIC_ENGINE_URL` | Public Render Engine origin used by existing live UI. |
| `CAPACITOR_SERVER_URL` | Production Hostinger origin used by the Android wrapper. |

Existing account-identity, signup-policy, and APK URL variables remain required when those features are enabled. No learning/database secret may use a `NEXT_PUBLIC_*` prefix.

### Engine / Render

| Variable | Requirement |
| --- | --- |
| `ADMIN_TOKEN` | 32+ byte independent random admin credential. |
| `CONTENT_API_REQUIRED` | Set `true` for canonical-only production mode. |
| `CONTENT_API_URL` | Full protected UI feed URL, normally `/api/v1/engine/questions`. |
| `CONTENT_API_TOKEN` | Same feed token as UI; not the admin/join/session secret. |
| `CONTENT_API_TIMEOUT_MS` | Upstream request timeout. |
| `CONTENT_API_MAX_BYTES` | Maximum accepted feed size. |
| `CONTENT_API_REFRESH_INTERVAL_MS` | Periodic refresh interval; `0` disables periodic refresh. |
| `PLAYER_JOIN_SECRET` | Existing 32+ byte room-join signing secret. |
| `DATABASE_URL` | Existing Render PostgreSQL runtime-state connection. |
| `STATE_PERSISTENCE_DRIVER` | `postgres` for durable production state. |
| `CORS_ORIGINS` | Exact Hostinger public origin(s). |
| `QUIZ_AUTO_START`, `QUIZ_CONTINUOUS` | Preserve current continuous production flow. |

Existing optional account identity and YouTube variables remain governed by their current rollout documentation.

## 17. Migration and rollback instructions

Do not apply the migration to the project that was connected during implementation.

1. Provision or select a dedicated Apologia non-production Supabase project.
2. Independently verify its project reference, database hostname, and environment with two sources; record identifiers without recording a password.
3. Take and test a database backup/export. Stop writers for the migration window.
4. Review the migration and confirm no name collision with any existing Apologia schema.
5. Apply only `supabase/migrations/20260717175144_phase1_learning_foundation.sql` in one transaction with `ON_ERROR_STOP=1`. Do not apply `plain_postgres_bootstrap.sql` to Supabase.
6. Run the functional/security tests in a suitable non-production validation environment and inspect grants/RLS with the actual Supabase roles.
7. Apply `supabase/fixtures/phase1_minimal.sql` only to the verified non-production environment. It is not production curriculum.
8. Configure UI/Engine secrets, verify `/api/v1/engine/questions`, perform a conditional Engine refresh, then exercise public, learner, staff, and live-room flows before promotion.
9. If legacy content is staged, use `phase1-content-transfer.mjs` to inventory, transform, validate, and generate SQL. Review counts and rights warnings before explicitly running the generated transaction. Keep all records hidden/draft/context-free.

For rollback:

1. Confirm the exact target again, take/test a fresh backup, and stop writers.
2. Prefer a forward fix or removal of only never-published staging records when data already exists.
3. If full foundation removal is explicitly approved, execute `supabase/rollback/20260717175144_phase1_learning_foundation.down.sql` with `ON_ERROR_STOP=1` as one transaction.
4. Verify that only the intended Phase 1 objects were removed and restore from the tested backup if needed.

The down migration destroys all Phase 1 content, learner, and game data. It is not an ordinary content-import undo command.

## 18. Remaining risks

1. **Hosted target absent:** there is no verified Apologia Supabase target, backup, migration result, or deployed RLS proof.
2. **Deployment absent:** Hostinger and Render still serve the prior production versions, so canonical end-to-end behavior is unverified.
3. **Worktree build layout:** the ordinary Turbopack command cannot accept this feature worktree's out-of-root `node_modules` junction, and an in-OneDrive Webpack attempt timed out. The exact source passed an isolated Webpack production build, but the deployment checkout must use an ordinary in-root dependency installation.
4. **Browser/device coverage:** no full Playwright matrix, signed APK/AAB runtime test, offline/reconnect device test, or production live-room rehearsal has been completed.
5. **Editorial tooling depth:** revision comparison, unpublished rendered preview, question-usage inspection, computed analytics, broken-reference detection, and licence-warning workflows require completion or staging proof.
6. **Assets:** Supabase Storage buckets, policies, transformations, and licensing rules are intentionally absent.
7. **Scheduled publication:** scheduled rows require a trusted publisher job to transition them to `published`; elapsed time alone does not publish content.
8. **Identity rollout:** existing signed-session identities need controlled learner-profile reconciliation in the actual database; Supabase learner JWTs must remain separate from staff sessions.
9. **Operational database behavior:** pooling mode, connection limits, timeouts, backups, monitoring, and recovery must be tested from the real Hostinger runtime.
10. **Legacy rights:** the 265-question legacy inventory is structurally valid but not theologically/editorially/licensing approved and must not be published automatically.
11. **Graph integration:** relationship columns/tables are present, but no new Graph API contract or Graph deployment was required or validated in this phase.
12. **Capacitor environment:** sync tooling ran, but the missing application URL and sibling-junction paths made its generated native changes unsuitable to retain. Regenerate from the intended checkout with production configuration, then build and test the APK/AAB.
13. **Delivery authentication:** the GitHub CLI was not authenticated, blocking commit/push/draft-PR publication from this task environment.
14. **Observability:** health/diagnostic fields exist, but alerting and production runbooks must be connected to the deployed services.

## 19. Decisions deferred to the Rules phase

- Catholic curriculum scope, sequence, doctrinal governance, approver qualifications, and escalation rules.
- Source authority tiers, Scripture translation policy, Catechism citation policy, quotation limits, copyright/licensing evidence, and media rights.
- Final question-authoring rubric, misconception taxonomy, denomination/comparison scope, ambiguity review, and quarantine criteria.
- Retake limits, remediation flow, question selection, adaptive difficulty, mastery threshold exceptions, expert challenges, and reassessment policy.
- Review scheduling/spaced-repetition policy and how live performance may inform recommendations without granting mastery.
- Achievement/certificate definitions and subject/programme completion semantics beyond derived group completion.
- Localisation/translation workflow, search thesauri, final taxonomy, and accessibility editorial standards.
- Final asset/storage policy, CDN transformations, offline licence eligibility, and downloadable-resource rules.
- Any future monetisation; payment status remains outside core doctrinal progression.

The database stores configurable fields for these policies where practical, but Phase 1 does not invent their final values.

## 20. Recommended next prompt

Use a rollout-closure prompt before beginning curriculum or question-bank generation:

> Continue the Apologia Sancta Phase 1 rollout from the UI and Engine `codex/phase1-learning-platform` draft PRs. First provision or identify a dedicated Apologia Supabase **staging** project and independently verify its project reference and database hostname; do not touch `rgfloeshqjbjfdarwdxn`. Take and test a backup, apply the Phase 1 migration and neutral fixture, run the database security/functional suites with real Supabase roles, and record an import/migration report. Configure independent Hostinger and Render secrets, deploy preview/staging revisions, refresh the canonical Engine feed, and execute public catalogue, learner progress/bookmarks, successful and failed mastery unlocks, staff review/publication/archive, PWA offline progress sync, Capacitor, REST/SSE live-room, restart recovery, and answer-leakage tests. Fix and repeat until all checks pass. Prepare production promotion and rollback steps, but do not migrate, deploy, merge, or publish production content without explicit approval.

After that rollout is accepted, the next product phase should define the Rules and Governance specification before any large Catholic curriculum or question bank is authored.
