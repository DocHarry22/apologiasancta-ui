# Content correction reports

Quiz, Learn, Research, and the separate Graph frontend use the central editorial
correction queue at `/author/review` (also available through the admin Review tab).

Readers can report incorrect answers, broken citations, unclear wording, unfair
representation, or another content issue. Signed-in readers submit through
`POST /api/content-reports` using the normal session and CSRF token. Guests see
the same action and are prompted to sign in; the pending public-content snapshot
and their entered explanation survive that sign-in on the same browser tab.

## Version retention

Opening the action freezes the displayed content. Later question changes, live
round advances, or catalogue refreshes cannot retarget an open report. A report
retains the source app, content type, stable content ID, supplied published
revision ID or learning version, and an immutable snapshot of the public content
shown to the reader. The server computes a canonical SHA-256 fingerprint of the
snapshot. For legacy unversioned content, `sha256:<fingerprint>` is its revision
reference. Live Engine payloads include a `contentId` and `reportRevisionId`
computed from the selected pool entry, including its answer and teaching, without
returning that hidden content before reveal.

Reports are reader-supplied evidence, including any supplied revision ID. They do
not attest source authenticity or confer editorial approval. Reviewers inspect
the preserved evidence against the governed source. The submission path never
looks up a newer version to replace the reported snapshot.

## Editorial handling

`GET /api/workflow/reports` and `PATCH /api/workflow/reports/:id` require the
existing `content:review` or `learning:review` permission; mutations require CSRF.
The Review tab provides open, in-review, resolved, and dismissed filters, the
reported snapshot, its fingerprint, content editor links, and retained history.
Each transition requires an editorial note. Resolving additionally requires the
new corrected revision reference, different from the reported revision. Reopening
retains both the original evidence and all earlier notes. Normal independent
review and publication still happen in the existing content editors.

The existing editorial database adapter stores individual report rows in
`content_correction_reports` (PostgreSQL or MySQL). It creates the table on first
use, as the workflow adapter does. File-mode development uses
`APP_DATA_DIR/content-reports.json`. Database uniqueness deduplicates identical
retries; row locks and report versions prevent concurrent review overwrites.
File-mode mutations serialize in one process, matching the existing file-store
deployment boundary. Account-scoped rate limits follow the existing in-process
limiter; multiple application instances should use a shared rate-limit backend.
There is no silent fallback to a local file after a database failure.

## Graph configuration

Set `CONTENT_REPORT_APP_URL` on the Graph server to this application's HTTPS
origin. For example, use the same public origin configured as
`NEXT_PUBLIC_APP_URL` here. Graph exposes only the normalized `/report-issue` URL
through `/api/reporting`; credentials, query strings, and paths in the configured
value are excluded. Development defaults to `http://localhost:3000`.

Graph opens `/report-issue` in a new tab with the selected claim, exact published
revision, snapshot, and source context in a URL fragment. The main app preserves
that handoff for authentication, then removes the fragment from the address bar.
No Graph server needs the reader's session cookies or an editorial admin token.
Production without a valid HTTPS reporting origin shows an unavailable message
when readers use the action.

## Verification

UI: `npx vitest run src/lib/server/storage/contentReportStore.test.ts src/lib/server/contentReportApi.test.ts src/components/content/ReportIssue.test.tsx`

Engine: `node --import tsx --test src/content/reportReference.test.ts`

Graph: `npx vitest run server/contentReporting.test.js`
