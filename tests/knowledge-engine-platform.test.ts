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
    "knowledge_node_id",
    "lesson_version",
    "question_version",
  ]) {
    assert.ok(migration.includes(required), `missing Knowledge bridge schema: ${required}`);
  }
  assert.match(migration, /mastery_attempts/);
  assert.match(migration, /mastery_answers/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /auth\.uid\(\) = learner_id/);
});

test("learner node mastery is derived server-side from stored successful assessment evidence", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.[a-z0-9_]*knowledge[a-z0-9_]*/i);
  assert.match(migration, /mastered\s*=\s*true|mastered\)/i);
  assert.match(migration, /INSERT INTO public\.learner_node_mastery/i);
  assert.match(migration, /INSERT INTO public\.learner_node_mastery_evidence/i);
  assert.match(migration, /ON CONFLICT/i);
});

test("Research page consumes canonical published topics and deep-links the Galaxy by focus node", () => {
  assert.match(researchSource, /fetchKnowledgeEngine\("\/knowledge\/topics"/);
  assert.match(researchSource, /Knowledge Engine connected/);
  assert.match(researchSource, /url\.searchParams\.set\("focus", nodeId\)/);
  assert.match(researchSource, /Draft imports remain intentionally hidden/);
});
