# Phase 1 schema mapping

## Canonical ownership

| Existing responsibility/source | Phase 1 canonical destination | Transition rule |
| --- | --- | --- |
| Bundled `content/topics/**` question JSON | `content.questions`, `question_options`, `sources`, `content_sources` | Keep JSON intact. Stage through the offline transformer as hidden drafts with no contexts. |
| Hard-coded learn-path presentation | `content.programmes`, `subjects`, `learning_groups`, `lessons` | UI/API reads configured published hierarchy; names and ordering are not component constants. |
| Device-local lesson state | `public.lesson_progress`, `bookmarks` | Device state may be a cache/offline queue; authenticated server state becomes durable truth. |
| Browser-calculated practice result | No official mastery authority | Official mastery uses the database RPC and immutable attempt snapshots. |
| Existing custom signed sessions | `public.learner_profiles(identity_provider, external_subject)` | Trusted UI API resolves the internal learner UUID. Supabase Auth is optional via `auth_user_id`. |
| Engine in-memory published question cache | `content.published_live_question_feed` | Render may cache; the service-only feed remains persistent truth. |
| Engine room snapshot persistence | `game.*` normalization target | Migration can be incremental; learning mastery remains separate from live-game scoring. |
| Current workflow/audit JSON stores | `content.content_versions`, `content.audit_log` | Server adapters may dual-read during rollout; do not maintain two writable canonical stores. |
| Hostinger filesystem | None | It serves the application, not canonical content. |
| GitHub repository | Migrations, validators, fixtures, transfer tools and docs | Never use Git as the production content database. |

## Table map

### `content`

| Table | Key relationships/purpose |
| --- | --- |
| `programmes` | Root catalogue entity. |
| `programme_prerequisites` | Programme dependency graph. |
| `subjects` | `programme_id -> programmes`. |
| `subject_prerequisites` | Subject dependency graph. |
| `learning_groups` | `subject_id -> subjects`; mastery threshold/policy and initial unlock. |
| `group_prerequisites` | Group dependency graph, including multiple prerequisites. |
| `lessons` | `group_id -> learning_groups`. |
| `lesson_prerequisites` | Lesson dependency graph. |
| `lesson_sections` | Structured/nested lesson blocks. |
| `learning_objectives` | Ordered lesson outcomes. |
| `sources` | Bibliographic/reference metadata and rights state. |
| `content_sources` | Typed entity-to-source links with citation locators. |
| `content_relationships` | Typed related-content and Apologia Graph-style links. |
| `questions` | Canonical prompt/workflow record; private explanation and answer policy. |
| `question_options` | Enabled option content, private correctness and explanations. |
| `question_contexts` | Usage eligibility and availability window. |
| `content_versions` | Immutable explicit revision snapshots. |
| `audit_log` | Append-only content and mastery event trail. |

### `public`

| Table | Key relationships/purpose |
| --- | --- |
| `learner_profiles` | Internal learner identity with Supabase/custom-session bridges. |
| `lesson_progress` | Per-learner state, percentage and resume locator. |
| `bookmarks` | Per-learner lesson/section bookmarks. |
| `mastery_attempts` | Attempt lifecycle, thresholds, result and idempotency keys. |
| `mastery_attempt_questions` | Immutable private prompt/option/scoring/result snapshots. |
| `mastery_answers` | Server-validated selections and score per attempt question. |
| `unlocks` | Auditable materialization of derived eligibility. |
| `group_progress` | Lesson counts, best score and verified mastery. |
| `review_schedule` | Per-question due date and initial spacing state. |
| `question_metrics` | Aggregate performance counters; not learner-readable. |

`review_recommendations` is an authenticated, owner-filtered view over due scheduling and public practice metadata.

### `game`

| Table | Purpose |
| --- | --- |
| `rooms` | Durable room configuration/runtime snapshot. |
| `room_participants` | Guest or learner-linked room identity. |
| `sessions` | One live rotation/session in a room. |
| `session_questions` | Versioned question payload and private scoring snapshot. |
| `player_answers` | Idempotent participant response. |
| `leaderboard_entries` | Durable period-scoped score aggregates. |

## Read contracts

Safe content reads use `content.published_*` views. The initial public question contract is deliberately split:

- `published_questions`: prompt metadata for public practice only.
- `published_question_options`: enabled option ID/position/label/content only.
- `published_question_contexts`: enabled `lesson_practice`/`group_practice` contexts only.
- `published_live_question_feed`: service-only complete four-option live payload, including answer key.
- Mastery start RPC: owner-scoped sanitized immutable assessment payload.
- Mastery submit RPC: post-score result with permitted answer/explanation data.

No route should read raw `questions`, `question_options` or `mastery_attempt_questions` with a browser credential.

## Progress and unlock truth

Validated `mastery_attempts` plus `mastery_answers` are the scoring source of truth. `group_progress` and `unlocks` are transactionally updated, auditable read models. Eligibility is still recomputed from current prerequisite rules before an attempt or a new unlock, preventing a client or stale materialization from granting mastery.

Subject/programme progress remains derived from their non-optional groups in Phase 1. Live-game performance may update analytics later, but never grants learning mastery automatically.
