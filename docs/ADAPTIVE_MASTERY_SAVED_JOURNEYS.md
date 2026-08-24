# Adaptive mastery and saved canonical journeys

This slice completes two remaining Knowledge Engine product commitments without creating a second theology database.

## Evidence-based concept recommendations

`public.learner_node_mastery` remains the authoritative learner concept-mastery record. It is derived from stored, server-scored submitted assessment evidence.

The adaptive endpoint is:

`GET /api/v1/learning/recommendations/knowledge`

Rules:

- a concept must have `evidence_attempts > 0` before it can be classified as a knowledge gap;
- unseen concepts remain unknown rather than being labelled weak;
- only mastery below the bounded requested threshold is returned;
- lower mastery ranks before higher mastery, then stronger evidence volume breaks ties;
- published lesson/question mappings are attached when available;
- the browser cannot supply correctness or mastery values.

## Durable canonical journeys

Saved journeys live in `public.saved_knowledge_journeys` and store only:

- learner ownership;
- title;
- canonical root ID;
- bounded ordered canonical node IDs;
- lens;
- visibility;
- opaque share token;
- navigation metadata and timestamps.

The Knowledge Engine remains authoritative for propositions, evidence, assessments, edges and revisions.

### Security

- public table RLS is enabled;
- `anon` has no direct table privileges;
- authenticated CRUD is still constrained by owner policies;
- UPDATE uses both `USING` and `WITH CHECK` ownership predicates;
- canonical IDs use a database domain so direct Data API writes cannot insert malformed root or array values;
- learner mutations require the existing application session, CSRF validation and mutation rate limit;
- private rows are never returned by the shared-token lookup;
- shared URLs are opaque-token based and marked noindex/nofollow.

### Routes

- `GET|POST /api/v1/learning/journeys`
- `PATCH|DELETE /api/v1/learning/journeys/:journeyId`
- `GET /api/v1/learning/journeys/shared/:shareToken`
- `/research/journeys`
- `/research/journeys/:shareToken`

Timeline, Compare and Debate can save the exact canonical IDs returned by their published, bounded Knowledge Engine responses.

## Acceptance gates

- Supabase migrations apply on the disposable CI database;
- explicit grant and RLS regression passes;
- adaptive recommendations require stored assessment evidence;
- anonymous users cannot access learner-owned rows directly;
- invalid share tokens fail closed;
- lint, typecheck, Node tests, Vitest/component tests, production build, Playwright, editorial database acceptance and Android CI remain green.
