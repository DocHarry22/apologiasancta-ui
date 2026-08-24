import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clientSource = readFileSync("src/lib/server/knowledgeEngine.ts", "utf8");
const proxySource = readFileSync("src/app/api/knowledge/[[...path]]/route.ts", "utf8");
const researchSource = readFileSync("src/app/research/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260824020000_knowledge_engine_platform_bridge.sql", "utf8");

test("Knowledge Engine proxy remains same-origin, read-only, and bounded", () => {
  assert.match(proxySource, /export async function GET/);
  assert.doesNotMatch(proxySource, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(proxySource, /isAllowed\(segments/);
  assert.match(proxySource, /Valid left and right node IDs are required/);
  assert.match(clientSource, /response\.body\.getReader\(\)/);
  assert.match(clientSource, /totalBytes > maxBytes/);
  assert.match(clientSource, /reader\.cancel\("knowledge-engine-response-size-limit"\)/);
  assert.doesNotMatch(clientSource, /response\.text\(\)/);
});

test("platform bridge persists lesson/question mappings and learner mastery evidence", () => {
  for (const required of [
    "content.lesson_knowledge_nodes",
    "content.question_knowledge_nodes",
    "public.learner_node_mastery",
    "public.learner_node_mastery_evidence",
    "node_id text not null",
    "node_revision_id text",
    "private.apply_node_mastery_from_attempt",
  ]) {
    assert.ok(migration.includes(required), `missing Knowledge bridge schema: ${required}`);
  }
  assert.match(migration, /mastery_attempts/);
  assert.match(migration, /mastery_answers/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /auth\.uid\(\)/i);
});

test("learner node mastery is derived server-side from stored submitted assessment evidence", () => {
  assert.match(migration, /create or replace function private\.apply_node_mastery_from_attempt/i);
  assert.match(migration, /from public\.mastery_attempts/i);
  assert.match(migration, /join public\.mastery_answers/i);
  assert.match(migration, /join content\.question_knowledge_nodes/i);
  assert.match(migration, /insert into public\.learner_node_mastery_evidence/i);
  assert.match(migration, /on conflict \(attempt_id, question_id, node_id\) do nothing/i);
  assert.match(migration, /insert into public\.learner_node_mastery/i);
  assert.match(migration, /on conflict \(learner_id, node_id\) do update/i);
});

test("Research page consumes canonical published topics and deep-links the Galaxy by focus node", () => {
  assert.match(researchSource, /fetchKnowledgeEngine\("\/knowledge\/topics"/);
  assert.match(researchSource, /Knowledge Engine connected/);
  assert.match(researchSource, /url\.searchParams\.set\("focus", nodeId\)/);
  assert.match(researchSource, /Draft imports remain intentionally hidden/);
});
