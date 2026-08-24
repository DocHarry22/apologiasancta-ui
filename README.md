# Apologia Sancta

**Apologia Sancta** is a Catholic formation, apologetics, research, learning, live-quiz, and knowledge-visualization platform for web, PWA, and Android.

The application is built around one governing principle:

> **One governed body of apologetics knowledge, reused across Learn, Quiz, Research, Library, Articles, Debate, Admin, and the 3D Galaxy.**

The product is therefore an **Apologia Knowledge Engine** with multiple experiences over the same canonical propositions, sources, arguments, objections, responses, evidence, and reviewed perspectives.

## Repository architecture

| Repository | Responsibility |
|---|---|
| `apologiasancta-ui` | Main Next.js product, Learn, Quiz, Research, Library, Admin, PWA and Android shell |
| `apologiasancta-engine` | Canonical Knowledge Engine, provenance, revisions, publication governance, arguments, Timeline/Compare/Debate, coverage QA and governed authoring proposals |
| `apologia-graph` | Canonical 3D Galaxy, graph navigation, Evidence Inspector and advanced research visualization |

The repositories are deliberately separated so the canonical knowledge model is not duplicated inside individual product features.

## Implementation status

The original implementation plan has now been completed at the feature-architecture level.

### Phase A — Canonical Knowledge Foundation — COMPLETE

- Canonical nodes and stable identities
- Typed edges
- Aliases and claim families
- Immutable node and edge revisions
- Published-vs-current revision isolation
- Sources and exact citations
- Revision-bound provenance assertions
- Catholic and comparative lens assessments
- Review records tied to immutable revision hashes
- Governed publication gates
- Bounded graph traversal
- Evidence lookup and comparison APIs
- Reconciliation and duplicate suggestions
- Database-level publication integrity constraints

### Phase B — Knowledge Journeys and Canonical Galaxy — COMPLETE

- Topics
- Curated paths
- Structured arguments
- Premises, objections, responses and evidence
- Canonical Graph/Galaxy neighborhoods
- Evidence Inspector
- Provenance-aware graph rendering
- Canonical node recentering
- Bounded traversal
- Timeline, Compare and Debate research workspace

### Phase C — Platform Integration — COMPLETE

- Learn mapped to canonical knowledge nodes
- Quiz questions mapped to tested knowledge nodes
- Server-derived concept mastery
- Research backed by published Knowledge Engine topics
- Library/source integration boundaries
- Same-origin server-side Knowledge Engine access
- No browser exposure of Knowledge Engine administrative credentials
- Graceful behavior when the Engine is unavailable

### Phase D — Advanced Apologetics and Adaptive Learning — COMPLETE

- Timeline research
- Compare research
- Debate / Argument Battle foundation
- Knowledge Coverage QA
- Unsupported-claim/provenance-gap detection
- Review and citation backlogs
- Evidence-backed mastery-gap recommendations
- Unseen concepts remain **unknown**, not incorrectly labelled weak
- Durable learner-owned research journeys
- Private and unlisted journey sharing
- Opaque share tokens
- Galaxy reopening from canonical journey nodes
- RLS and ownership enforcement for saved journeys

### Phase E — Governed Authoring Assistance — COMPLETE

- Proposal-only authoring assistance
- Persisted proposal records
- Proposal expiry/rejection
- Editor review workflow
- Acceptance requires governed draft revision identifiers
- No automatic theological approval
- No automatic publication
- Human editorial governance remains authoritative

### Current production-hardening phase — IN PROGRESS

The remaining work is no longer a feature-architecture rewrite. It is release hardening and deployment verification.

Current security work includes:

- Next.js upgrade from `16.2.10` to `16.3.2`
- `eslint-config-next` aligned to `16.3.2`
- removal of the stale PostCSS override that forced `postcss 8.5.18`
- patched `sharp` override to `0.35.3` while the upstream Next dependency range is still on the `0.34.x` line
- explicit production and high-severity npm audit commands
- lockfile regeneration using npm rather than hand-editing `package-lock.json`
- CI gates that distinguish production dependency exposure from development-only findings

The dependency security PR must remain unmerged until the regenerated lockfile and complete CI audit prove that no unresolved production high/moderate findings remain. Any remaining development-only finding will be documented separately rather than misrepresented as a production vulnerability.

## Production boundary

Feature completion and production deployment are separate gates.

The application is **not considered fully production-live** until all of the following are verified against the actual deployment infrastructure:

1. Production Supabase migrations apply successfully.
2. Knowledge Engine production deployment is healthy.
3. Main UI production deployment is healthy.
4. Galaxy production deployment is healthy.
5. Public Knowledge Engine API calls return only published material.
6. Authentication, authorization and RLS are verified against production.
7. Saved journeys work for owner, anonymous shared-link and revoked-link cases.
8. Learn mastery is derived from server-scored evidence.
9. Quiz publication and question provenance remain governed.
10. Evidence Inspector exposes the correct source/revision/provenance chain.
11. Android release build installs and starts successfully.
12. Final accessibility, performance and production smoke tests pass.

Provider-side deployment credentials/configuration are intentionally not substituted with unrelated connected infrastructure.

## Security model

The platform follows these rules:

- Browser clients never receive Knowledge Engine admin credentials.
- Public APIs expose published revisions only.
- Draft and current revisions remain isolated from public reads.
- Publication requires the appropriate review and provenance state.
- Edge assertions are revision-bound.
- Evidence citations are revision-bound.
- Learner mastery is server-derived.
- Learners cannot directly write mastery rows.
- Saved journeys are account-owned through RLS.
- Shared journeys use opaque tokens and do not expose account ownership.
- AI/heuristic authoring creates proposals, not truth.
- Proposal acceptance does not equal publication.
- Production audit failures block release rather than being hidden behind a warning.

## Research model

The same canonical knowledge can be explored through:

- **Galaxy** — spatial exploration of connected canonical knowledge
- **Timeline** — chronological historical research where dates are explicitly sourced
- **Compare** — structured comparison using stored canonical relationships
- **Debate** — objection/response/argument traversal over published material
- **Evidence Inspector** — source, citation, provenance and review inspection
- **Saved Journeys** — persistent, shareable research paths

The UI does not invent theological relationships merely to make a graph look connected.

## Learning model

Concept mastery is attached to canonical knowledge nodes rather than duplicated lesson-specific concepts.

A concept becomes a mastery gap only when the platform has stored, server-scored assessment evidence. An unseen concept remains unknown. Recommendations therefore distinguish:

- **Weak** — supported by assessment evidence
- **Unknown** — insufficient evidence
- **Mastered** — sufficient evidence according to the mastery model

This prevents the adaptive layer from turning absence of activity into a false theological or educational judgement.

## Technology

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Capacitor 7
- Android SDK 35/36 CI compatibility
- Java 21
- PostgreSQL / Supabase-compatible schema
- MySQL editorial acceptance testing
- Vitest
- Playwright
- Node.js 22 CI

## Development

Install dependencies using the committed lockfile:

```bash
npm ci
```

Run the web application:

```bash
npm run dev
```

Run the principal checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:vitest
npm run build
npm run test:e2e
```

Run dependency security checks:

```bash
npm run audit:production
npm run audit:high
```

Run editorial database acceptance:

```bash
npm run test:editorial-database
```

Run curriculum/content validation:

```bash
npm run curriculum:check
npm run content:check
```

## CI release gates

The UI CI pipeline is expected to keep all of these green:

- dependency installation from the committed lockfile
- production dependency audit
- high-severity dependency audit
- ESLint
- TypeScript
- Node regression suite
- component/route tests
- production build
- Playwright E2E
- PostgreSQL editorial acceptance
- MySQL editorial acceptance
- Supabase migration/RLS policy tests
- Android build/test/lint/APK verification

A green build without a reproducible lockfile is not considered a green production build.

## Android

Package identifier:

`com.apologiasancta.live`

The Android application is a Capacitor shell over the production web experience. Android CI validates SDK/toolchain compatibility and the generated release APK.

## Knowledge governance

Apologia Sancta follows the Catholic Church as the default doctrinal lens for its Catholic apologetics content. Comparative material may be presented through attributed lenses, but the platform must distinguish:

1. what a source claims,
2. what historical evidence supports,
3. what a particular Christian or non-Christian tradition teaches,
4. what the Catholic Church teaches, and
5. what remains unresolved or disputed.

The Knowledge Engine therefore stores provenance and perspective explicitly instead of collapsing all statements into an undifferentiated graph of "facts."

## Editorial principle

The most important production rule is simple:

> **No unexplained line, duplicated proposition, hidden draft, invented citation, client-authoritative mastery score, or AI-generated theological claim should become canonical merely because the software can display it.**

Software governs the workflow. Human-reviewed evidence governs publication.
