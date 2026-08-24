import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repo = readFileSync("src/lib/server/learning/knowledgeLearnerRepository.ts", "utf8");
const handlers = readFileSync("src/lib/server/learning/knowledgeLearnerHandlers.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260824123000_adaptive_mastery_saved_journeys.sql", "utf8");
const saveControl = readFileSync("src/components/research/SaveKnowledgeJourneyButton.tsx", "utf8");
const savedList = readFileSync("src/components/research/SavedKnowledgeJourneys.tsx", "utf8");
const sharedPage = readFileSync("src/app/research/journeys/[shareToken]/page.tsx", "utf8");
const learnPage = readFileSync("src/app/learn/page.tsx", "utf8");

test("adaptive recommendations require real server-scored concept evidence", () => {
  assert.match(repo, /m\.evidence_attempts > 0/);
  assert.match(repo, /m\.mastery_percent < \$2/);
  assert.match(repo, /ORDER BY m\.mastery_percent ASC, m\.evidence_attempts DESC/);
  assert.match(repo, /content\.lesson_knowledge_nodes/);
  assert.match(repo, /content\.question_knowledge_nodes/);
  assert.match(repo, /recommendationType: "knowledge_gap"/);
  assert.match(repo, /evidenceBasis: "stored_server_scored_mastery"/);
  assert.match(handlers, /unseenConceptsExcluded: true/);
  assert.match(learnPage, /KnowledgeGapRecommendations/);
});

test("saved journeys store canonical identifiers with owner RLS and no anonymous table access", () => {
  assert.match(migration, /create table if not exists public\.saved_knowledge_journeys/i);
  assert.match(migration, /references public\.learner_profiles\(id\) on delete cascade/i);
  assert.match(migration, /root_node_id text not null check \(root_node_id ~ /i);
  assert.match(migration, /node_ids text\[\] not null check \(cardinality\(node_ids\) between 1 and 120\)/i);
  assert.match(migration, /alter table public\.saved_knowledge_journeys enable row level security/i);
  assert.match(migration, /revoke all on table public\.saved_knowledge_journeys from anon/i);
  assert.match(migration, /to authenticated[\s\S]*auth\.uid\(\)/i);
  assert.match(migration, /with check[\s\S]*auth\.uid\(\)/i);
});

test("shared journeys are token-gated and never expose private rows", () => {
  assert.match(repo, /share_token = \$1/);
  assert.match(repo, /visibility IN \('unlisted','public'\)/);
  assert.match(sharedPage, /robots: \{ index: false, follow: false \}/);
  assert.match(sharedPage, /navigation identifiers only/);
  assert.doesNotMatch(sharedPage, /DATABASE_URL|LEARNING_DATABASE_URL|service_role|ENGINE_ADMIN_TOKEN/);
});

test("research modes persist bounded canonical paths through same-origin learner APIs", () => {
  assert.match(saveControl, /\/api\/v1\/learning\/journeys/);
  assert.match(saveControl, /nodeIds: uniqueNodes/);
  assert.match(saveControl, /slice\(0, 120\)/);
  assert.match(saveControl, /\/api\/auth\/csrf/);
  assert.match(savedList, /\/api\/v1\/learning\/journeys\?limit=100/);
  assert.match(savedList, /method: "DELETE"/);
  assert.doesNotMatch(saveControl, /LEARNING_DATABASE_URL|service_role|DATABASE_URL/);
});
