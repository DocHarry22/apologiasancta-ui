# Phase 1 schema foundation

## Scope

`supabase/migrations/20260717175144_phase1_learning_foundation.sql` establishes the repository-local PostgreSQL foundation for learning content, learner state and durable game state. It does not connect to, inspect or mutate a hosted Supabase project. The repository's current production project association is intentionally not used.

The migration is data-free. `supabase/fixtures/phase1_minimal.sql` is a separate, explicit, neutral fixture for local and non-production verification only.

## Schema boundaries

| Schema | Responsibility | Client access |
| --- | --- | --- |
| `content` | Programmes, curriculum hierarchy, structured blocks, sources, canonical questions, workflow, versions and audit | Public roles receive column-limited access plus RLS and safe published views. Staff writes use a trusted server. |
| `public` | Learner identity bridge, progress, bookmarks, mastery state, unlocks, review scheduling and metrics | A Supabase-authenticated learner may read/write only the explicitly granted rows/columns. Existing custom sessions use the trusted server. |
| `game` | Rooms, participants, sessions, session questions, answers and leaderboard persistence | `service_role` only. The Render engine remains the runtime authority for active room flow. |
| `private` | Security-definer helpers and scoring implementation | Not an exposed Data API schema. Only narrowly required helper execution is granted. |

Adding `content` to Supabase's Data API exposed schemas is a separate project setting. If it remains unexposed, the application API must proxy the safe views. RLS and explicit grants still apply if it is exposed later.

## Content hierarchy and workflow

The configurable hierarchy is:

`content.programmes -> content.subjects -> content.learning_groups -> content.lessons -> content.lesson_sections / content.learning_objectives`

Prerequisites are represented by `programme_prerequisites`, `subject_prerequisites`, `group_prerequisites` and `lesson_prerequisites`. Multiple rows mean that every configured prerequisite must pass. A deferrable cycle guard rejects dependency cycles.

Publishable entities use these states:

- Publication: `draft`, `in_review`, `changes_requested`, `approved`, `scheduled`, `published`, `archived`.
- Review: `unreviewed`, `pending`, `changes_requested`, `approved`.
- Visibility: `public`, `authenticated`, `hidden`, `locked`, `coming_soon`.

The database requires approved review state before scheduling or publishing, requires the relevant timestamp for published/scheduled/archived state, prevents version decreases, and refuses deletion of anything that has been published. Archive/version it instead.

`lesson_sections.content` is structured JSON. `block_kind` covers rich text, headings, Scripture/Catechism references, quotations, tables, media, expandable explanations, comparisons, objection/response cards, footnotes, related content and resources. Arbitrary HTML is not part of this contract.

## Canonical question bank

`content.questions` contains question metadata, prompt, private explanation, review state and retirement state. `question_options` contains option content, the private `is_correct` flag and per-option explanation. `question_contexts` makes a question eligible for one or more purposes.

An enabled question cannot cross the public-practice and official-assessment boundary:

- Public practice set: `lesson_practice`, `group_practice`.
- Official assessment set: `mastery_assessment`, `expert_challenge`.

The deferrable constraint trigger `question_contexts_no_practice_mastery_overlap` rejects conflicting inserts and updates with SQLSTATE `23514`. `live_quiz`, `daily_challenge` and `review_quiz` remain orthogonal.

The public question and option views never contain `is_correct`, correct-answer explanations, option explanations, answer policy or private notes. Public practice views include only enabled public-practice questions with a fully public, published ancestor chain.

## Published view semantics

All published views use PostgreSQL 15+ `security_invoker` and also contain explicit status, date and visibility predicates. The explicit predicates protect server connections that own the tables and therefore bypass ordinary RLS.

- Hierarchy preview views (`published_programmes`, `published_subjects`, `published_learning_groups`, `published_lessons`, `published_catalogue_feed`) allow only `public`, `locked` and `coming_soon` metadata. `authenticated` and `hidden` are excluded.
- `published_lesson_sections`, `published_learning_objectives`, `published_sources` and public practice views require `public` visibility throughout the ancestor chain.
- `published_questions`, `published_question_options` and `published_question_contexts` contain public practice only.
- `published_content_sources` exposes safe citation metadata, not quoted text or authoring identities.
- `published_live_question_feed` and `invalid_live_question_configurations` are `service_role` only.

The live feed accepts a row only when all of the following are true:

1. Question and ancestors are public, published and currently effective.
2. Question is active and has an active `live_quiz` context.
3. Type is `single_choice` or `true_false`.
4. Exactly four options are enabled.
5. Exactly one enabled option is correct.

Malformed live rows are excluded rather than allowed to poison a cold engine refresh. The service-only diagnostic view returns the rejection reasons.

## Learner identity and RLS

`public.learner_profiles.id` is the durable internal learner key.

- Supabase Auth users map through nullable, unique `auth_user_id -> auth.users.id`.
- Existing signed-session identities map through the partial unique pair `(identity_provider, external_subject)`.
- A browser JWT can access a profile only when `auth.uid() = auth_user_id`.
- A custom-session server resolves `external_subject`, then invokes trusted operations with its server-only `service_role` credential.

Supabase-authenticated users receive direct, owner-scoped access to their profile, lesson progress and bookmarks. They receive owner-scoped read access to attempts, post-submit answers, unlocks, group progress and review scheduling. They cannot insert attempts/answers/unlocks or read attempt scoring snapshots. Custom-session requests use the same tables through trusted server routes.

Do not place a service-role key in client JavaScript, the PWA bundle or the APK. Do not use user-editable `user_metadata` for authorization.

## Mastery RPC contract

### Start

```sql
public.start_mastery_attempt(
  p_learner_id uuid,
  p_group_id uuid,
  p_idempotency_key text,
  p_question_limit integer default 10
) returns jsonb
```

The function verifies caller/learner ownership, re-evaluates programme/subject/group prerequisites, records the unlock basis, creates an attempt, deterministically selects eligible published mastery questions and stores immutable prompt/option/scoring/result snapshots. A repeated learner/idempotency key returns the same attempt.

The returned `questions` contain only:

```json
{
  "question_id": "uuid",
  "position": 0,
  "version": 1,
  "question_type": "single_choice",
  "difficulty": 1,
  "prompt": { "type": "text", "text": "..." },
  "options": [
    { "option_id": "uuid", "position": 0, "label": "A", "content": { "type": "text", "text": "..." } }
  ]
}
```

It never returns correctness, scoring snapshots or explanations.

### Submit

```sql
public.submit_mastery_attempt(
  p_learner_id uuid,
  p_attempt_id uuid,
  p_idempotency_key text,
  p_answers jsonb
) returns jsonb
```

`p_answers` must contain exactly one object per selected question:

```json
[
  {
    "question_id": "uuid",
    "selected_option_ids": ["uuid"]
  }
]
```

The transaction locks the attempt, validates question/option membership, inserts all answers, scores against the immutable private snapshot, records the result, updates group progress, metrics and review schedule, recomputes eligible unlocks, writes audit data, then returns permitted post-submit explanations and correct options. Any error rolls back the entire submission.

The same idempotency key and exact JSON payload returns the stored result without changing counters. A different payload or key after submission is rejected. Official mastery and unlocks are never derived from client-calculated scores.

## Audit and versioning

Content mutations append complete before/after snapshots to `content.audit_log`. Trusted server code may set `SET LOCAL app.actor_id = '<staff uuid>'` so custom staff identities are captured. `content.content_versions` stores explicit version snapshots for preview/diff/restore workflows. Audit and version tables have no public role policies.

## Apply and verify locally

Discover the installed CLI surface before using it:

```powershell
npx --yes supabase@latest --help
npx --yes supabase@latest db --help
```

For an initialized local Supabase stack, apply using the local migration workflow. Do not use `db push` until the target project reference/host has been independently verified and a backup exists.

The repository-local SQL checks can also be run against a disposable PostgreSQL 16+ database in this order:

1. `supabase/tests/plain_postgres_bootstrap.sql` (plain PostgreSQL only; never deploy to Supabase).
2. `supabase/migrations/20260717175144_phase1_learning_foundation.sql`.
3. `supabase/fixtures/phase1_minimal.sql`.
4. `supabase/tests/phase1_foundation_test.sql`.
5. `supabase/tests/phase1_security_catalog_test.sql`.

The tests cover migration syntax, FK/cycle constraints, fixture idempotence, published visibility under owner bypass, answer-key grants, context separation, authenticated RLS, server scoring, replay safety, successful/failed unlocks, live-feed eligibility, metrics and review scheduling.

## Rollback

`supabase/rollback/20260717175144_phase1_learning_foundation.down.sql` removes only the objects declared by the foundation migration. It destroys all Phase 1 content, learner and game data. Before running it:

1. Verify the exact host, database and project reference.
2. Take and test a backup/export.
3. Stop writers.
4. Run with `ON_ERROR_STOP=1` as one transaction.
5. Verify the three schemas and Phase 1 public objects are absent.

The rollback was exercised in a clean down/up cycle during implementation.

## Phase 1 assumptions and deferred policy

- Staff users currently live outside Supabase Auth, so content `created_by`/`reviewed_by` UUIDs deliberately have no `auth.users` FK.
- Programme/subject completion is derived from group progress; no competing subject-progress table is materialized.
- Unlock rows are an auditable cache. Eligibility is re-derived from validated progress and current prerequisite rules.
- The initial review scheduler is intentionally simple. Detailed retake, remediation, adaptive selection and spacing policy belongs to the Rules phase.
- Storage buckets/policies are not created here. Asset columns store approved storage paths/URLs; a separate storage migration should define bucket-specific rights after asset policy is approved.
- Scheduled content does not become public merely because its date passed. A trusted publication job must transition it to `published`.
