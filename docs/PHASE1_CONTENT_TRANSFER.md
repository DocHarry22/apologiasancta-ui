# Phase 1 content import and export

## Safety model

The transfer tools are offline by default. `scripts/phase1-content-transfer.mjs` reads files and emits JSON or SQL; it never opens a database connection. An operator must review and explicitly execute generated SQL.

Do not run an import against the currently connected hosted Supabase project. Before any future hosted operation, independently verify the project reference, database hostname and environment, take a backup, and use a non-production branch/project first.

Exports contain answer keys, private notes, review metadata and unpublished content. Treat them like database backups: do not commit them, upload them to public storage or print them in CI logs.

## Legacy inventory snapshot

The repository inventory performed on 2026-07-17 found:

| Item | Count |
| --- | ---: |
| Topic records | 22 |
| Question JSON records | 265 |
| Source-reference occurrences | 595 |
| Blocking structural issues | 0 |

This is an inventory, not an editorial or rights approval. The importer intentionally stages every legacy record as hidden draft content.

Run the inventory again whenever source JSON changes:

```powershell
node scripts/phase1-content-transfer.mjs inventory --source content/topics
```

## Legacy-to-canonical mapping

| Legacy JSON | Canonical destination | Notes |
| --- | --- | --- |
| Topic index/meta | `content.subjects` | One subject per legacy topic under the staging programme. |
| Implicit topic bank | `content.learning_groups` | One hidden staging group per subject. It is not initially unlocked. |
| `question.id` | `content.questions.stable_key` | Original stable identifier is preserved. A deterministic UUID is derived from it. |
| `topicId` | `subject_id`, `group_id` | Resolved through deterministic topic mappings. |
| `question` | `prompt` | Stored as `{type:"text", text:"..."}`. |
| `difficulty` | `difficulty` | Retains the 1..5 value. |
| `choices` | `content.question_options` | Labels and order are preserved; deterministic option UUIDs are generated. |
| `correctId` | `question_options.is_correct` | Remains private and is never placed in a public view. |
| `teaching.title/body` | `correct_answer_explanation` | Imported as private draft explanation. |
| `teaching.refs[]` | `content.sources` + `content.content_sources` | Reference strings become deduplicated draft source records. No quoted source text is imported. |
| `tags` | `search_metadata` | Topic tags are retained as staging/search metadata. |

The transform does not create question contexts. No imported legacy question becomes eligible for public practice, mastery, expert challenge, live quiz, daily challenge or review until a human assigns an allowed context after editorial, theological and rights review.

## Deterministic identity and idempotence

UUIDs are deterministic SHA-256-derived, RFC-variant identifiers scoped by entity type and legacy key. Re-running the transform yields the same entity IDs. The generated SQL uses `ON CONFLICT` on stable primary/composite keys and updates the staged records in one transaction.

An existing conflicting slug or stable key owned by a different UUID fails the transaction rather than silently merging unrelated records. This is intentional.

## Transform and validate

Generate a reviewable canonical bundle outside the repository or in an ignored working directory:

```powershell
node scripts/phase1-content-transfer.mjs transform `
  --source content/topics `
  --output C:\safe-temp\phase1-staging-bundle.json

node scripts/phase1-content-transfer.mjs validate `
  --input C:\safe-temp\phase1-staging-bundle.json
```

Validation checks the format, table arrays, stable-key uniqueness, required correct-option counts and the public-practice/official-mastery context separation rule. Rights warnings are expected for the legacy collection and must remain unresolved until a human review supplies approved metadata.

Generate an idempotent, transactional import script:

```powershell
node scripts/phase1-content-transfer.mjs import-sql `
  --input C:\safe-temp\phase1-staging-bundle.json `
  --output C:\safe-temp\phase1-staging-import.sql `
  --actor 00000000-0000-4000-8000-000000000001
```

`--actor` is optional and records the importing staff UUID through `app.actor_id`. Review the SQL diff and record counts before execution.

## Execute in a verified target

Use a task-specific variable rather than a generic or production environment variable:

```powershell
$env:PHASE1_TARGET_DB_URL = 'postgresql://...verified-non-production-target...'
psql $env:PHASE1_TARGET_DB_URL `
  -X `
  -v ON_ERROR_STOP=1 `
  -f C:\safe-temp\phase1-staging-import.sql
```

Before execution, confirm all of the following:

1. The hostname/project reference matches the intended non-production target.
2. The foundation migration is present.
3. A backup/export completed successfully.
4. The generated records are `draft`, `hidden`, `unreviewed` and have no contexts.
5. No secret appears in the SQL or logs.

After import, compare bundle counts with database counts, sample stable IDs/options/sources, inspect audit entries, and verify that none of the staging records appears in a `published_*` view.

## Canonical export

`supabase/scripts/export_phase1_content.sql` produces one canonical JSON document containing the content hierarchy, prerequisites, questions/options/contexts, sources/relationships and content versions. It does not export learner progress, game state or the append-only audit log.

```powershell
$env:PHASE1_TARGET_DB_URL = 'postgresql://...verified-target...'
psql $env:PHASE1_TARGET_DB_URL `
  -X -q -t -A `
  -f supabase/scripts/export_phase1_content.sql `
  | Set-Content -Encoding utf8 C:\safe-backup\phase1-content.json

node scripts/phase1-content-transfer.mjs validate `
  --input C:\safe-backup\phase1-content.json
```

The export includes private answer and workflow data. Store it encrypted with limited access.

To produce reviewable re-import SQL from an export:

```powershell
node scripts/phase1-content-transfer.mjs import-sql `
  --input C:\safe-backup\phase1-content.json `
  --output C:\safe-backup\phase1-content-reimport.sql
```

## Import report and reconciliation

Record these items for every import:

- Bundle checksum and generation timestamp.
- Source repository commit.
- Target project reference/hostname (never the password).
- Per-table intended and resulting counts.
- Conflicts/failures.
- Sampled stable-key/UUID comparisons.
- Public-view count for staged records (must be zero).
- Reviewer and rights-review owner.

Do not delete the source JSON after import. Keep it until record counts, stable IDs, answer keys, source links and public exclusion have all been independently verified.

## Re-import and rollback

A failed generated import rolls back automatically because it is enclosed in one transaction and should be executed with `ON_ERROR_STOP=1`.

For a successful but unwanted staging import, prefer deleting only never-published staging records by their deterministic staging programme ID after taking an export. Do not delete published records. The full schema rollback file is not a content-import undo tool; it destroys the entire Phase 1 foundation.

For corrected source JSON:

1. Re-run inventory.
2. Transform and validate a fresh bundle.
3. Diff it against the prior bundle.
4. Generate fresh SQL.
5. Execute in non-production.
6. Reconcile counts and audit changes.
7. Promote records through the ordinary review/publication workflow only after content and rights approval.
