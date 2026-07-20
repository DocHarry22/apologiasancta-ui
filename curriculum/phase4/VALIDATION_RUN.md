# Phase 4 Validation Run

Run date: 2026-07-20

## Passed checks

- `npm run content:verify-citations`: 47 source records passed; 11 official publishers limited automated content access and were recorded as access limitations; 0 failures.
- `npm run content:check`: Phase 3 prerequisites and graph validated; 815 Phase 4 drafts generated in 118 subject batches; the complete Phase 4 content validator passed.
- `node --test tests/phase4-content-production.test.mjs`: 4 of 4 Phase 4 production tests passed.
- `npm test`: 47 of 47 API, workflow, security, curriculum, and platform tests passed.
- `npm run test:vitest`: 206 of 206 component, server, storage, and rendering tests passed across 42 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed with no warnings or errors.
- `npm run build`: the Next.js production build compiled, type-checked, and generated all static routes successfully.
- `git diff --check`: passed.

## Browser check

The normal development-server browser run exceeded five minutes before the OneDrive-backed development server became reachable. The same suite was then run against the successful production build:

- 7 of 11 browser scenarios passed, including public routes, responsive widths, unified theme/navigation, security headers, and removal of raw admin-token controls.
- 3 admin scenarios remained on `/admin/login` after submitting the configured test credentials.
- 1 mobile room-switch scenario timed out because an open modal intercepted the room-selection click.

These four failures are recorded as platform test issues. They do not change any lesson to reviewed, approved, or published.

## Quality boundary

The automated checks establish structural completeness, reference resolution, provisional Scripture-policy compliance, internal text-reuse limits, readability limits, and workflow safety. They do not replace claim-level semantic citation review, doctrinal approval, comparative specialist review, external-corpus plagiarism review, or licensing approval by accountable humans.
