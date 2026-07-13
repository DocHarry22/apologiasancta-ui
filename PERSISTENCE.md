# Persistence

Phase 4A uses a shared server-side persistence layer. When `DATABASE_URL` or a complete `MYSQL_*` configuration is present, production records are stored in the `app_kv_store` PostgreSQL/MySQL table. Local development falls back to atomic JSON snapshots under `.data/`.

This is intentionally hidden behind store abstractions in `src/lib/server/storage/`:

- `jsonStore.ts` provides idempotent database schema setup, atomic upserts, missing-file handling, atomic temp-file writes, and one-time import of existing JSON snapshots.
- `workflowStore.ts` persists draft, review, publish, archive, comments, validation state, and item history.
- `auditStore.ts` appends sanitized audit events and supports filtering.
- Admin users are resolved through the database-backed `admin_users` table. `userStore.ts` remains only as a transitional fallback for legacy non-user-id code paths.

`.data/` is ignored by Git and runtime data must not be committed. Set `APP_STORAGE_DRIVER=file` only when an intentional local file override is required.

## Production Behavior

The configured admin database is also the source of truth for workflow drafts, audit events, invite settings, and transitional user records. PostgreSQL uses JSONB and `ON CONFLICT`; MySQL uses JSON and `ON DUPLICATE KEY`. Schema creation and writes are idempotent.

If a database row does not exist when database storage is enabled, the store reads any existing local JSON snapshot once and imports non-default data. API routes and dashboard calls remain unchanged.

Read-modify-write operations are serialized within an application instance. A future normalized-schema migration is still recommended before horizontally scaling authoring across multiple concurrent server instances.

## Future Normalization Path

Keep API routes and dashboard calls unchanged when replacing JSON payload records with normalized tables behind:

- `listWorkflowItems`, `getWorkflowItem`, `createWorkflowDraft`, `updateWorkflowDraft`, and `transitionWorkflowItem`
- `appendAuditEvent` and `listAuditEvents`
- `getOrCreateTransitionalUser`

The target database should enforce workflow item versions, transition history, audit immutability, indexes for filters, and row-level access rules matching the server permission helpers.

## Workflow Lifecycle

Valid statuses are `draft`, `submitted`, `changes_requested`, `approved`, `rejected`, `published`, and `archived`.

Publishing validates content first. In Phase 4A, published workflow items are marked as `publishTarget: "workflow_store"` and are not silently written to the public library content files or GitHub.

## Audit Model

Audit events include actor, role, event type, action, resource, request path/method, status, severity, IP/user agent when available, and sanitized metadata. Secrets such as session cookies, CSRF tokens, passwords, and admin tokens are redacted.

## User And Role Limits

`GET /api/auth/me` exposes the current database-backed admin user and permissions. Full user invitation, role assignment, and deactivation UI remain a later task.
