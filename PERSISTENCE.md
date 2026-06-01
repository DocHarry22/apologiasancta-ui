# Persistence

Phase 4A uses a transitional server-side JSON persistence layer under `.data/`.

This is intentionally hidden behind store abstractions in `src/lib/server/storage/`:

- `jsonStore.ts` provides missing-file handling and atomic temp-file writes.
- `workflowStore.ts` persists draft, review, publish, archive, comments, validation state, and item history.
- `auditStore.ts` appends sanitized audit events and supports filtering.
- `userStore.ts` stores the transitional local author identity while still deriving role authority from server-side `AUTHOR_DEFAULT_ROLE`.

`.data/` is ignored by Git and runtime data must not be committed.

## Production Limitation

JSON files are not suitable for multi-instance production. Concurrent writes from multiple app instances can race, and data lives on the instance filesystem. A production deployment should migrate these stores to Postgres, Supabase, or another durable database with transactions and backups.

## Migration Path

Keep API routes and dashboard calls unchanged. Replace the implementations behind:

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

`GET /api/auth/me` exposes the current durable transitional user and permissions. Full user invitation, role assignment, and deactivation UI remain a Phase 4B task. Until then, role authority remains server-side through `AUTHOR_DEFAULT_ROLE`.

