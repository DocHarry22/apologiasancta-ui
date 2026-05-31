# Admin Dashboard

Phase 3 turns `/author` into a role-aware operations workspace for content, review, rooms, topics, live hosting, and audit visibility.

## Roles

Roles are defined in `src/lib/auth/roles.ts`.

- `super_admin`: full dashboard access, user/role management permission placeholder, content, publishing, rooms, live engine, audit, and dangerous actions.
- `admin`: room management, topic sequence, live engine, content import/view, audit, and settings. Super Admin management is not exposed.
- `author`: create draft questions, import draft content, edit own in-session drafts, submit for review, and view approved/published content.
- `reviewer`: view submitted questions, approve, reject, request changes, comment, and flag doctrinal/reference issues.
- `host`: operate the live engine and active room controls without content editing.
- `viewer`: read-only dashboard access for overview, question bank, and settings.

Server-side admin proxy permission checks are enforced in `src/lib/server/engineProxy.ts`. Hidden tabs are not the only control.

## Transitional Auth

The current author login proves an authenticated session but does not carry a database user identity. `src/lib/server/currentUser.ts` resolves a transitional user:

```ts
{
  id: "local-author",
  displayName: "Author",
  role: AUTHOR_DEFAULT_ROLE
}
```

Set `AUTHOR_DEFAULT_ROLE` to one of `super_admin`, `admin`, `author`, `reviewer`, `host`, or `viewer`.

Development defaults to `super_admin` when the variable is not set. Production defaults to `viewer` unless `AUTHOR_DEFAULT_ROLE` is explicitly configured. Do not store trusted roles in `localStorage`.

## Sections

- Overview: engine health, rooms summary, topic/status snapshot, persistence status, and role-aware quick links.
- Live Control: room-scoped start, pause, resume, next, reset, topic countdown, skip, replay, and emergency pause.
- Rooms: create rooms, select current room, copy room URL, view active/closed status and player counts, close rooms with confirmation.
- Question Bank: search by text, topic, difficulty, status, and tags; view question details, validation warnings, correct answer, teaching, references, and duplicate into authoring.
- Authoring: create questions, preview JSON, save in-session drafts, submit for review, and batch import through the admin proxy.
- Review: submitted queue, approval, rejection, changes requested, reviewer comments, doctrinal flags, and reference flags.
- Topics: metadata visibility, validation, question counts, IDs, tags, difficulty range, quiz pool controls, and sequence editor.
- Audit: prepared audit model plus in-session workflow event visibility. Real persisted audit logs require backend storage.
- Settings: role/environment status, app links, persistence/GitHub state, and logout.

## Workflow

Workflow domain types live in `src/lib/contentWorkflow.ts`.

Supported statuses:

- `draft`
- `submitted`
- `changes_requested`
- `approved`
- `rejected`
- `published`
- `archived`

Workflow items are now persisted through authenticated `/api/workflow/items` routes backed by the local JSON store in `.data/`. Published JSON under `content/topics` remains the source of truth for live/library content.

## Validation

`src/lib/contentValidation.ts` validates:

- required fields
- choice labels
- `correctId` exists
- references array
- topic ID exists
- question ID pattern
- duplicate published IDs
- difficulty range
- teaching body

Topic and sequence helpers live in `src/lib/topicOperations.ts` and `src/lib/topicSequence.ts`.

## Dangerous Actions

Dangerous actions use a modal with action summary and consequences. GitHub content deletion requires typed confirmation.

Protected actions include:

- reset room
- close room
- clear local content bank
- clear GitHub content
- skip/replay topic
- save a new topic sequence

## Known Limitations

- Workflow and audit data use local JSON files under `.data/`; this is durable for a single app instance but not a transactional multi-instance production store.
- Publishing currently marks approved workflow items as published in the workflow store only. It does not modify public library content or GitHub.
- Live leaderboard top scorers/streaks are not shown because the current admin status endpoint does not expose them.
- User and role management permissions exist, but full database-backed user administration is not implemented.

## Phase 4 Starting Point

Replace local JSON storage with database-backed users, roles, workflow, and audit tables. Then wire approved publishing into the chosen content publishing pipeline with reviewer attribution.
# Phase 4A Persistence Notes

The Author dashboard now loads workflow items from authenticated `/api/workflow/items` routes instead of treating React state as workflow truth. Draft, submit, review, publish, and archive actions persist server-side and create audit events.

The Audit tab reads persisted events from `/api/audit/events`. It shows an unavailable state when storage or permissions block the request and does not render fake audit logs as real data.

Publishing currently marks approved items as published in the workflow store only. It does not silently modify public library content or GitHub.
