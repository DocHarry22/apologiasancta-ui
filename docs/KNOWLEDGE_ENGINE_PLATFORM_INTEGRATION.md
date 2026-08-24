# Knowledge Engine platform integration

This branch connects the existing Phase 1/2 learning, quiz, library, research, editorial, PWA and Android product to the canonical Apologia Knowledge Engine without replacing the existing governed learning schema.

## Non-negotiable architecture

- The Knowledge Engine is authoritative for globally reusable apologetics propositions, sources, edges, assessments, paths and arguments.
- The existing `content.*` learning schema remains authoritative for pedagogical ordering, lesson presentation, question delivery and mastery attempts.
- Integration is by canonical references, never by duplicating Knowledge Engine propositions into lesson/question rows.
- Public/browser code never receives Engine admin tokens, database credentials, or internal URLs.
- Only published Knowledge Engine records are consumed by public routes.
- An unavailable Knowledge Engine must degrade safely: ordinary published lessons/quizzes remain usable, while graph/evidence enhancement is marked unavailable rather than fabricated.
- AI does not publish or approve theological content.

## Required schema bridge

Add a repeatable Supabase/PostgreSQL migration after Phase 2 with:

1. `content.lesson_knowledge_nodes`
   - lesson_id UUID FK `content.lessons`
   - node_id TEXT canonical ID
   - node_revision_id TEXT nullable until publication mapping is pinned
   - role: primary|supporting|objection|response|evidence|prerequisite
   - display_order
   - metadata JSONB
   - unique mapping key

2. `content.question_knowledge_nodes`
   - question_id UUID FK `content.questions`
   - node_id TEXT
   - node_revision_id TEXT nullable
   - role: tested|distractor_concept|explanation|evidence
   - metadata JSONB

3. `public.learner_node_mastery`
   - learner_id UUID FK `public.learner_profiles`
   - node_id TEXT
   - mastery_percent 0..100
   - evidence_attempts, correct_evidence, last_question_id, last_attempt_id
   - first_evidence_at, last_evidence_at, updated_at
   - primary key learner_id,node_id

Canonical IDs must satisfy the Engine canonical-ID pattern. Direct learner writes to node mastery are forbidden; mastery is updated server-side from governed assessment evidence. RLS must preserve the existing learner ownership boundary.

## Server-only Engine client

Implement a bounded server client using `KNOWLEDGE_ENGINE_URL`, falling back to `ENGINE_INTERNAL_URL` only when explicitly safe. Production requires HTTPS, refuses redirects, has request timeout and response-size limits, and validates JSON. Public reads need no Engine admin token.

Expose same-origin public routes for status/topics/node/evidence/neighborhood/path/argument/compare as needed. Cache published reads briefly where safe; personalized mastery responses remain no-store.

## Learn

Lesson detail responses should include mapped canonical node references. The lesson UI should offer contextual actions such as `Explore this claim`, `Inspect evidence`, and related apologetics paths only when the mapped published Knowledge Engine data exists. The lesson itself must remain usable if the Engine is unavailable.

## Quiz and mastery

Published question payloads should carry approved `testedNodeIds` derived from `content.question_knowledge_nodes`; never infer them from prompt text at runtime. After a submitted governed attempt, update `learner_node_mastery` from the question results. The update must be idempotent for an attempt and must not allow client-supplied correctness to decide mastery.

Live Engine question ingestion should preserve tested canonical node IDs from the canonical content feed without exposing answer keys before reveal.

## Library and Research

The Library should link canonical source/claim mappings when available. Research should consume live published Knowledge Engine topics rather than hard-coded conceptual path cards, while retaining a transparent unavailable state. Apologia Graph remains the visual research surface and receives stable canonical focus IDs/deep links.

## Admin

Extend the existing CMS/Editorial Queue rather than create a second unrelated admin. Editors need canonical node search/reconciliation, lesson/question mapping, evidence links, review state, and a Knowledge Foundry/coverage view. Mapping cannot auto-publish or auto-approve canonical knowledge.

## Tests / acceptance

- migration applies twice safely in disposable PostgreSQL and rollback is documented
- RLS prevents cross-learner node mastery access and direct client mastery mutation
- server Engine client rejects HTTP in production, redirects, oversized/invalid payloads and timeout
- Research renders live published topics and honest unavailable state
- lesson mapped/unmapped/unavailable enhancement tests
- question feed includes only approved stored tested-node mappings
- mastery update is idempotent and derives correctness from stored attempt snapshots
- lint, typecheck, Vitest/Node tests, production build, Playwright and Android CI remain green
