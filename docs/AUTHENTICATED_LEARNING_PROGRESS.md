# Authenticated learning progress foundation

This slice adds opt-in cross-device progress without changing Apologia Sancta's custom 7-day HMAC/HttpOnly session model and without adding Supabase. PostgreSQL and MySQL remain the supported stores. The browser's existing `apologia-learning-progress-v1` value remains the offline copy and is migrated in place; no completion, best score, or legacy practice-attempt total is cleared during upgrade.

## Safety gate and bootstrap

Cloud access requires both a supported database configuration and `LEARNING_CLOUD_SYNC_ENABLED=true`. Otherwise authenticated progress routes return `503` with `localFallback: true`; lesson and practice actions continue to save locally and retry later.

`npm run db:migrate:learning` applies repeatable DDL and records migration `2026071601_authenticated_learning_progress`. Run it only with server-side database credentials after the existing account bootstrap has created `admin_users`. Runtime access also replays the idempotent statements, which repairs a deploy interrupted before the migration-ledger insert.

PostgreSQL uses `TIMESTAMPTZ`. MySQL connections are pinned to UTC and use `DATETIME(3)`/`UTC_TIMESTAMP(3)`. API timestamps are normalized to ISO-8601 UTC.

## Schema and access paths

- `learning_profiles`: one aggregate and monotonic revision per `admin_users.id`; indexed by update time.
- `learning_lesson_progress`: account/lesson composite primary key with an account/update index.
- `learning_progress_mutations`: account/mutation composite primary key for exactly-once practice-attempt application, plus an account/application-time index.
- `app_schema_migrations`: repeatable migration ledger.

Every learning table has an indexed foreign key to `admin_users(id)` with `ON DELETE CASCADE`. Database credentials and account IDs are never browser-selected fields.

## API contract

`GET /api/learning/progress` and `POST /api/learning/progress` require the existing signed HttpOnly session. POST additionally requires the existing HMAC double-submit CSRF token. Responses are `private, no-store`.

POST accepts only:

```json
{
  "baseRevision": 3,
  "completedLessonIds": ["real-presence-eucharist"],
  "practiceBest": 7,
  "practiceAttemptsFloor": 2,
  "clientUpdatedAt": "2026-07-16T12:00:00.000Z",
  "practiceAttempts": [
    {
      "id": "d8142501-1f1d-4f7d-9d5a-2bed0e66afe8",
      "kind": "practice_attempt",
      "score": 7,
      "occurredAt": "2026-07-16T12:00:00.000Z"
    }
  ]
}
```

Unknown keys (including `accountId` or `userId`), unknown lesson IDs, duplicate/invalid mutation IDs, non-integer counts, timestamps outside the allowed range, wrong content types, malformed JSON, and bodies over 64 KiB are rejected. The repository always keys reads and writes with `auth.user.id` derived from the verified session.

The sync transaction locks one account profile, unions lesson completions, takes the maximum best score and legacy attempt floor, applies each new mutation ID exactly once, then advances the revision once. A stale `baseRevision` is reported as `conflictMerged: true` and merged monotonically instead of overwriting either device. A response lost after commit is safe to retry because the composite mutation key deduplicates it.

## Browser merge and offline behavior

The v1 aggregate is upgraded with:

- a preserved legacy attempt floor;
- a durable pending queue for new practice-attempt events;
- last observed server revision and sync timestamp.

On sign-in, reconnect, dashboard load, or a new progress action, the client reads cloud state, unions it with the latest local value, sends at most 100 events per request, and removes events only after acknowledgment. Requests are serialized per tab and re-read local storage after every network response so in-flight lesson changes are not overwritten. Network, auth, flag, or database failures leave the local copy intact.

## Security and current limits

- The session remains an HttpOnly, Secure `__Host-` cookie in production; no token is moved to local storage.
- Mutations use same-origin credentials and CSRF verification.
- Logs include only operation and error class, never SQL, payloads, cookies, connection strings, or driver messages.
- An account can report its own study totals; these are formation indicators, not prize-grade competition evidence.
- Account-wide progress deletion/export is intentionally not claimed by this slice. The Account control clears only the device copy and says cloud progress may return. Add a revisioned deletion tombstone and verified export before public commercial launch.

## Rollback

Set `LEARNING_CLOUD_SYNC_ENABLED=false` and redeploy. Learning continues locally; do not drop the tables during rollback. Re-enable after repairing database health so queued events can sync. Because writes are monotonic and idempotent, a normal disable/re-enable cycle does not erase progress.
