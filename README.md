# Apologia Sancta

**Apologia Sancta** is a Catholic formation, apologetics, research, learning, and live-quiz platform for web, PWA, and Android.

The project is being rebuilt around one governing principle:

> **One governed body of apologetics knowledge, reused across Learn, Quiz, Research, Library, Articles, Debate, Admin, and the 3D Galaxy.**

The long-term product is not merely a quiz site with a separate graph. It is an **Apologia Knowledge Engine** with multiple user experiences over the same canonical propositions, sources, arguments, objections, responses, evidence, and reviewed perspectives.

This repository contains the main Next.js application and Android/PWA shell.

- **Frontend / product:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Mobile:** Capacitor 7, Android SDK 35, Java 21
- **Learning data:** PostgreSQL / Supabase-compatible schema
- **Live quiz:** `apologiasancta-engine`
- **Canonical apologetics knowledge:** Knowledge Engine APIs in `apologiasancta-engine`
- **3D research visualization:** `apologia-graph`
- **Current web deployment target:** Hostinger Node/Next
- **Android package:** `com.apologiasancta.live`

---

## Architecture

```text
                         ┌──────────────────────────────┐
                         │   APOLOGIA KNOWLEDGE ENGINE │
                         │                              │
                         │ Canonical nodes              │
                         │ Typed edges                  │
                         │ Sources + citations          │
                         │ Edge assertions/provenance   │
                         │ Assessments / lenses         │
                         │ Topics + paths               │
                         │ Structured arguments         │
                         │ Immutable revisions/reviews  │
                         └──────────────┬───────────────┘
                                        │ canonical IDs
              ┌─────────────────────────┼──────────────────────────┐
              │                         │                          │
      ┌───────▼────────┐       ┌────────▼────────┐        ┌────────▼────────┐
      │ Apologia UI     │       │ Live Quiz Engine│        │ Apologia Galaxy │
      │                 │       │                 │        │                 │
      │ Learn           │       │ Rooms / SSE     │        │ 3D graph        │
      │ Quiz / Practice │       │ Scoring         │        │ Evidence view   │
      │ Library         │       │ Leaderboards    │        │ Lenses / paths  │
      │ Research        │       │ Question bank   │        │ Recentring      │
      │ Account         │       │ Runtime state   │        │ Exploration     │
      │ Admin / CMS     │       │                 │        │                 │
      └─────────────────┘       └─────────────────┘        └─────────────────┘
```

### Data ownership

The architecture deliberately separates **knowledge**, **pedagogy**, and **runtime gameplay**.

| Concern | Authority |
|---|---|
| Reusable apologetics propositions, evidence, relationships, sources, assessments, paths and arguments | Knowledge Engine |
| Curriculum order, lesson presentation, learning groups, question delivery and formal mastery attempts | `content.*` learning schema |
| Learner progress and canonical concept mastery | learner/public schema, updated by server-authoritative evidence |
| Live rooms, answer windows, scores, streaks and live leaderboards | Quiz Engine |
| 3D visualization and traversal | Apologia Graph, consuming canonical Knowledge Engine neighborhoods |

**The same theological proposition must not be copied independently into every feature.** Lessons and questions reference canonical Knowledge Engine IDs instead.

---

## Canonical Knowledge Model

The Knowledge Engine treats apologetics as a governed graph rather than a collection of isolated topic pages.

Core object families include:

- questions
- claims / propositions
- doctrines
- definitions
- Scripture references
- sources and exact citations
- people, councils, traditions and historical events
- objections
- responses and counter-responses
- evidence
- conclusions
- arguments
- curated topics and paths

Relationships are explicit and typed, for example:

- `supports`
- `contradicts`
- `responds_to`
- `depends_on`
- `qualifies`
- `quotes`
- `historically_precedes`
- `disputes_interpretation_of`

A relationship is not treated as self-justifying. Provenance is stored separately so the system can answer:

- Who asserts this relationship?
- Which source or citation supports it?
- Under which lens or tradition?
- Which revision was reviewed?
- Is it approved, disputed, inferred, or still under review?

---

## Catholic Perspective and Comparative Material

Apologia Sancta is a **Catholic formation and apologetics platform**.

Catholic teaching is therefore the default formation lens, while comparative positions are stored as attributed assessments rather than silently rewriting the underlying proposition or evidence.

The system is designed to distinguish:

```text
Proposition
  ├── Catholic assessment
  ├── Orthodox assessment
  ├── Protestant assessment(s)
  ├── Islamic assessment(s)
  └── historical-critical / academic assessment(s)
```

Different traditions may affirm, reject, qualify, or dispute the same proposition. Their assessment does not create a duplicate proposition unless the semantic claim is genuinely different.

Catholic authority metadata is structured rather than reduced to a simplistic numeric "truth score". Source type, magisterial status, binding scope, promulgating authority, tradition, document type, and citation provenance remain distinct.

---

## Human Review and Publication Governance

AI, automated importers, semantic search, and migration tools may **propose** content or relationships. They do not publish theology.

The publication boundary is human-governed and revision-specific.

Typical lifecycle:

```text
draft
  → submitted / in_review
  → source review
  → doctrinal review
  → assessment/editorial review
  → approved exact revision
  → published
```

Important invariants:

- revisions are immutable
- approvals are bound to a content hash and exact revision
- edits after approval create a new draft revision
- public reads expose published records only
- authors cannot silently approve their own theological revision
- source identity, citation, interpretation and editorial inference remain separate
- AI cannot auto-merge canonical nodes
- AI cannot auto-approve or auto-publish
- unsupported or disputed material remains visibly under review

---

## Learning Integration

The governed learning platform remains responsible for teaching sequence and assessment. The Knowledge Engine adds reusable canonical context.

### Lessons

Lessons map to canonical nodes through normalized mappings such as:

- `primary`
- `supporting`
- `objection`
- `response`
- `evidence`
- `prerequisite`

When a published mapping exists, a lesson can expose contextual actions such as:

- **Explore this claim**
- **Inspect evidence**
- **Open in Galaxy**
- **Follow related argument path**

A lesson must still remain readable when the Knowledge Engine is temporarily unavailable.

### Questions and mastery

Questions map to canonical knowledge using roles such as:

- `tested`
- `distractor_concept`
- `explanation`
- `evidence`

Canonical IDs are stored with the question. They are never inferred from prompt text at runtime.

Formal mastery is derived from stored, server-scored attempt evidence. The browser cannot award itself mastery by sending `correct: true`.

The implementation tracks both:

1. curriculum/group completion and unlock rules; and
2. concept-level mastery against canonical Knowledge Engine nodes.

The curriculum can therefore remain ordered from foundation to advanced material while the recommendation layer identifies specific concepts that still need work.

---

## Research and the 3D Galaxy

`/research` is the gateway into the canonical research system.

Research consumes published Knowledge Engine topics rather than maintaining a separate hard-coded theological database.

The external `apologia-graph` application is the immersive visualization surface. It progressively loads bounded canonical neighborhoods instead of attempting to render the entire database at once.

Expected semantic zoom hierarchy:

```text
Universe
  → Doctrine / constellation
  → Debate / topic
  → Argument system
  → Claim
  → Evidence / citation
```

Galaxy capabilities include or are being implemented around:

- bounded neighborhood loading
- canonical-node recentering
- guided paths and free exploration
- lens switching
- Evidence Inspector
- provenance-aware relationships
- saved traversal paths
- fullscreen graph mode
- retractable navigation remote
- desktop orbit/pan/zoom
- mobile touch, pinch and pan
- keyboard-accessible visible-node navigation
- legacy graph fallback during migration

Visualization metrics are **navigation aids, not truth scores**.

---

## Platform Experiences

The intended production platform exposes the same governed knowledge through different workflows.

### Learn

Structured Catholic formation with programmes, subjects, progressively unlocked groups, lessons, official mastery attempts, bookmarks, search, recommendations and account-linked progress.

### Quiz / Practice

Explanation-led practice plus server-authoritative live competition. Questions can test the same canonical concepts taught in Learn.

### Library

Searchable source/topic discovery. Where canonical mappings exist, Library records link directly into claims, evidence and related Galaxy paths.

### Research

Evidence-first exploration of published topics, propositions, objections, responses and source relationships.

### Debate

Planned argument-battle and debate-simulator experiences will use the same structured arguments:

```text
claim
  → objection
  → response
  → counter-response
  → evidence
```

### Admin / Knowledge Foundry

The existing CMS is extended rather than replaced by a second disconnected admin.

Editors need to be able to:

- search canonical claims and sources
- reconcile possible duplicates
- create narrower/broader/opposing/qualifying claims
- attach exact evidence
- map lessons and questions to canonical nodes
- inspect publication/review state
- edit structured arguments and curated paths
- identify unsupported claims and unanswered objections
- review AI-assisted proposals before any publication

---

## Repository Layout

Apologia Sancta currently spans three cooperating codebases.

| Repository | Responsibility |
|---|---|
| `DocHarry22/apologiasancta-ui` | Main web/PWA/Android product, Learn, Library, Research gateway, accounts and admin/CMS |
| `DocHarry22/apologiasancta-engine` | Live quiz runtime plus canonical Knowledge Engine APIs and PostgreSQL knowledge model |
| `DocHarry22/apologia-graph` | 3D Galaxy and canonical research visualization |

This README lives in the main product repository.

---

## Implementation Plan

Development follows dependency order. Spectacular UI is deliberately not allowed to outrun data integrity.

### Phase A — Canonical Knowledge Foundation

**Status: implemented and merged in the Engine.**

- canonical node identity
- aliases and claim families
- typed edges
- immutable node/edge/source revisions
- separate current vs published revisions
- sources and exact citations
- edge assertions and provenance
- assessments / lenses
- revision-bound review records
- governed publication events
- bounded neighborhood traversal
- Evidence APIs
- reconciliation support
- PostgreSQL migration and production startup gate

### Phase B — Journeys, Arguments and Galaxy

**Engine topics/paths/arguments: implemented and merged.**

**Galaxy canonical adapter: active integration work; CI-gated before merge.**

- topics become curated entry points rather than owners of duplicated graph nodes
- paths become reusable ordered journeys
- arguments become first-class compositional structures
- Galaxy consumes Knowledge Engine neighborhoods
- Evidence Inspector exposes provenance and source evidence
- lens and depth changes trigger bounded refetches
- canonical nodes can become the new center of exploration
- local legacy graph data remains an explicit migration fallback only

### Phase C — Connect the Product

**Active implementation in this repository.**

- lesson → canonical node mappings
- question → canonical node mappings
- learner node mastery
- server-only bounded Knowledge Engine client
- same-origin public Knowledge Engine proxy
- Research backed by published Knowledge Engine topics
- Learn contextual claim/evidence/Galaxy actions
- canonical IDs preserved through question feeds
- Library canonical source/claim links
- CMS reconciliation/mapping surfaces
- migration, RLS, route, component, E2E and Android tests

### Phase D — Advanced Apologetics

Next major product layer:

- Timeline / chronology mode
- richer Compare mode
- Debate simulator
- Argument Battle
- structural argument coverage analysis
- saved/shareable argument journeys
- Knowledge Coverage dashboard
- unanswered-objection and missing-evidence QA
- adaptive recommendation from concept mastery gaps

### Phase E — Governed AI Assistance

AI may assist authors and reviewers with:

- semantic duplicate suggestions
- claim extraction
- argument decomposition
- citation extraction
- relationship suggestions
- counterargument discovery
- missing-evidence detection
- quiz drafting
- lesson drafting
- semantic search

All such output remains a **proposal** until a human editor/reviewer acts on it.

---

## Current Release Boundary

A green pull request is not the same thing as a production deployment.

Before describing the new Knowledge Engine integration as production-live, all of the following must be true:

1. required PRs are merged to their correct main branches
2. database migrations are applied to the dedicated Apologia database, not an unrelated project
3. Engine environment variables and PostgreSQL migration succeed
4. Hostinger builds the reviewed UI commit as a Node/Next application
5. the Graph deployment uses the reviewed canonical adapter build
6. production smoke tests pass for public reads, login, Learn, mastery, live rooms, Research and Galaxy
7. Android CI is green and a signed release is verified before public APK/store distribution
8. theological/editorial publication remains independently reviewed

Provider configuration and database access are treated as deployment gates, not as things to fake around in source code.

---

## Main Routes

| Route | Purpose |
|---|---|
| `/` | Main product home |
| `/login` / `/signup` | Account authentication |
| `/account` | Profile, learning, quiz, saved items, appearance, security and privacy |
| `/learn` | Formation catalogue |
| `/learn/programmes/[programmeSlug]` | Programme hierarchy |
| `/learn/subjects/[subjectSlug]` | Subject hierarchy |
| `/learn/groups/[groupSlug]` | Learning group and lock state |
| `/learn/groups/[groupSlug]/mastery` | Official server-scored mastery attempt |
| `/learn/[lessonId]` | Database-backed lesson |
| `/learn/search` | Published learning search |
| `/practice` | Published practice questions |
| `/library` | Public library |
| `/library/[topicId]` | Library/topic detail |
| `/research` | Knowledge Engine / Galaxy research gateway |
| `/leaderboard` | Public quiz rankings |
| `/mobile` | Live mobile quiz player |
| `/native` | Native-oriented home experience |
| `/admin` | Protected administrative workspace |
| `/admin/learning` | Learning CMS |
| `/author` | Compatibility/staff workspace |
| `/privacy` | Current privacy overview |

---

## Security Boundaries

### Browser vs server

The browser must never receive:

- `ENGINE_ADMIN_TOKEN`
- database credentials
- Knowledge Engine internal URLs
- account identity signing secrets
- service-role credentials
- unpublished theological records
- answer keys before reveal

Admin Engine actions pass through a same-origin server proxy with session, CSRF, method/path allowlisting and rate-limit checks.

The Knowledge Engine public bridge is read-only and bounded. Production requires HTTPS, refuses redirects, limits response size, validates JSON, enforces request timeouts and exposes only allowlisted Knowledge routes.

### Learning database

Learner ownership is enforced by RLS where applicable.

Canonical node mastery is server-maintained. Direct learner mutation of mastery state is prohibited.

### Content publication

Publication is review-bound and fail-closed. A content object is not public merely because it exists in the database.

---

## Environment

Start from the committed template:

```bash
cp .env.example .env.local
```

Important variable families include:

```env
# Browser-safe public services
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENGINE_URL=http://localhost:4000
NEXT_PUBLIC_RESEARCH_GRAPH_URL=

# Server-to-server services
ENGINE_INTERNAL_URL=http://localhost:4000
ENGINE_ADMIN_TOKEN=

# Canonical Knowledge Engine reads
KNOWLEDGE_ENGINE_URL=http://localhost:4000
KNOWLEDGE_ENGINE_TIMEOUT_MS=5000
KNOWLEDGE_ENGINE_MAX_BYTES=2097152

# Staff/account storage
AUTHOR_SESSION_SECRET=
DATABASE_URL=

# Governed learning database
LEARNING_DATABASE_URL=
LEARNING_DB_SSL_MODE=require

# Engine canonical learning feed
CONTENT_API_TOKEN=

# Account-linked live-player identity (optional rollout)
ACCOUNT_IDENTITY_ENABLED=false
ACCOUNT_IDENTITY_SECRET=
ACCOUNT_IDENTITY_ISSUER=apologia-ui

# Android shell
CAPACITOR_SERVER_URL=http://localhost:3000
```

Never prefix secrets with `NEXT_PUBLIC_`.

---

## Local Development

### Requirements

- Node.js 22
- npm
- PostgreSQL when exercising database-backed workflows
- Java 21 + Android SDK 35 for local Android builds
- a compatible `apologiasancta-engine` instance for live-quiz and Knowledge Engine integration

### Install

```bash
npm ci
```

### Run

```bash
npm run dev
```

### Production build

```bash
npm run build
npm start
```

---

## Verification

The repository treats CI as a release gate rather than a ceremonial green badge.

Run the relevant checks before merge:

```bash
npm run lint
npm run typecheck
npm test
npm run test:vitest
npm run build
npm run test:e2e
```

Additional governed-content checks:

```bash
npm run curriculum:validate
npm run content:validate
npm run content:lint
npm run test:editorial-database
```

Android:

```bash
npm run cap:sync
```

GitHub Android CI additionally installs Java 21 and Android SDK 35, runs Android tests/lint/build, verifies the APK and uploads the debug artifact.

The full UI CI gate covers:

- dependency installation
- lint
- TypeScript
- Node/unit tests
- Vitest component/route tests
- production Next.js build
- Chromium Playwright E2E
- disposable database migration/policy tests
- PostgreSQL editorial acceptance
- MySQL editorial acceptance

A failed historical GitHub Actions email does not describe the current branch once a later commit has replaced it; use the latest PR head run as the merge gate.

---

## Android / PWA

### PWA

The web product includes:

- installable manifest
- app icons
- service worker
- safe published-content caching
- offline-aware lesson behavior
- no offline authority to grant official mastery/unlocks

### Android

```bash
npm run cap:sync
npm run cap:open:android
```

For signed distribution, use the repository's Android release workflow. Signing credentials belong in GitHub/provider secrets, never in source control.

The public APK path must point to a verified production-signed artifact; debug-signed builds are not valid public releases.

---

## Development Rules

1. **Canonical first.** Search/reuse existing Knowledge Engine nodes before creating duplicates.
2. **No silent theology duplication.** Learn, Quiz, Research and Articles reference canonical IDs.
3. **No AI publication.** Automation proposes; humans review and publish.
4. **No truth scores.** Visualization/coverage metrics describe structure and provenance, not theological truth.
5. **No draft leakage.** Public reads must remain published-only.
6. **No secret leakage.** Internal URLs/tokens stay server-side.
7. **No unbounded graph rendering.** Query bounded neighborhoods progressively.
8. **No client-authoritative mastery.** Formal mastery comes from stored, server-scored evidence.
9. **No generated audit shortcuts.** Immutable revisions, hashes, reviews and publication events are part of the product, not paperwork to bypass.
10. **No deployment fiction.** Code merged, database migrated, provider deployed and smoke-tested are separate states.

---

## Key Documentation

- [Knowledge Engine platform integration](./docs/KNOWLEDGE_ENGINE_PLATFORM_INTEGRATION.md)
- [Operational audit](./docs/OPERATIONAL_AUDIT.md)
- [Unified product redesign](./docs/UNIFIED_REDESIGN.md)
- [Product roadmap](./docs/PRODUCT_ROADMAP.md)
- [Production runbook](./docs/PRODUCTION_RUNBOOK.md)
- [Testing](./TESTING.md)
- [Security setup](./SECURITY_SETUP.md)
- [Production checklist](./PRODUCTION_CHECKLIST.md)

The Engine and Galaxy repositories contain their own Knowledge Engine and graph-specific implementation documents.

---

## Product Goal

The target experience is simple to state even though the underlying system is not:

> **Every question has an explorable argument universe.**

From a single theological or historical proposition, a user should eventually be able to:

**understand → inspect evidence → identify sources → compare assessments → follow objections → study a lesson → answer questions → measure mastery → practise a defense → debate → explore the Galaxy → save/share the path**

All of those experiences should remain connected to the same reviewed canonical knowledge instead of slowly contradicting one another in separate content silos.
