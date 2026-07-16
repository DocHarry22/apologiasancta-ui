# Human-reviewed theological content workflow

## Purpose

Apologia Sancta treats AI output, batch input, and author drafts as untrusted editorial material. Nothing in this workflow asserts new doctrine. A named human reviewer must independently check the exact revision against its cited primary sources before a publisher can send it to the live Engine.

## Enforced state path

`draft -> submitted -> approved -> published`

Reviewers may instead request changes or reject. Editing creates a new immutable revision ID and SHA-256 content hash and clears any earlier approval. Approval is tied to the current revision ID and content hash; publishing recomputes and verifies the hash before creating an outbox claim.

After changes are requested, the flagged revision cannot be resubmitted. The author must save a new immutable revision whose canonical content hash also differs; the original revision-bound decision, flags, comment, and event remain append-only audit evidence. A person who creates the current revision cannot review that revision, even when they are an administrator or were not the workflow item's original author.

The following checks are server-side and cannot be bypassed by changing browser state:

- The author ID and reviewer ID must differ, including for admins and super-admins.
- Submission requires a substantive teaching explanation and at least one structured primary Catholic source. Scholarship can supplement but cannot be the only source.
- Approval requires a reviewer comment, no unresolved doctrinal/reference flag, and explicit attestations for doctrinal fidelity, source checking, explanatory support, charitable language, and independent review.
- The approved revision snapshot is immutable. Editing creates a new snapshot and invalidates prior approval.
- Publication only uses the stored approved snapshot, never a new request-body copy.
- Each publication has a deterministic idempotency key derived from workflow item, approved revision, and content hash.
- A processing lease blocks concurrent publishes. The Engine request timeout is clamped to finish at least five seconds before that lease expires. Failure leaves the item approved and retryable; retry reuses the same key and exact payload. Engine import is an upsert by question ID, and the UI also sends `Idempotency-Key`.
- Direct dashboard import is denied by default. The emergency bypass requires `EDITORIAL_EMERGENCY_IMPORT_ENABLED=true` and a super-admin session and creates a blocked/allowed proxy audit trail.

## Durable records

The repeatable schema supports PostgreSQL and MySQL:

- `content_workflow_items`: current indexed workflow projection and JSON payload.
- `content_workflow_revisions`: append-only revision snapshots and hashes.
- `content_review_records`: append-only decisions and reviewer attestations.
- `content_workflow_events`: append-only workflow audit events.
- `content_publication_outbox`: retry state, attempt count, lease, safe error summary, and Engine acknowledgement.
- `app_schema_migrations`: applied additive migration key.

Production must use database storage. File storage is retained for local development and focused tests only; its in-process queue is not a multi-instance coordination mechanism.

## Safe failure and recovery

- Engine rejects/unreachable: outbox becomes `failed`; workflow item stays `approved`; retry is safe.
- UI process exits after claiming: the processing lease expires after 30-300 seconds, then the exact revision can be retried.
- Engine accepts but UI cannot record completion: return a safe `503`. After the lease, retry the same upsert and complete the outbox.
- Database unavailable: do not enable file fallback in production. Restore database access and retry; never recreate an approval from memory.
- Legacy item: it may be read and migrated, but a legacy approval without structured sources, exact hash, and attestation cannot publish.

## Deployment and rollback

1. Back up the application database.
2. Deploy to a review environment with the same PostgreSQL/MySQL dialect as production.
3. Exercise author, independent reviewer, failed publish, retry, and completed replay cases.
4. Keep `EDITORIAL_EMERGENCY_IMPORT_ENABLED=false` for ordinary operation.
5. Roll back application code if necessary, but retain the additive tables and outbox records. Dropping them loses review and retry evidence.

## Current limitations

- Engine-level administrators who possess its raw admin token can still call the Engine directly; protect and rotate that credential and restrict it to the UI server/deployment operators.
- The Engine currently behaves idempotently by upserting a stable question ID. It receives the idempotency header, but durable Engine-side receipt storage should be added in its own repository for defense in depth.
- URL presence is optional because authoritative citations may not have stable public links. When supplied, the workflow requires HTTPS, but a reviewer must still verify that the destination is the cited source.
