import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicProxy = readFileSync("src/app/api/knowledge/[[...path]]/route.ts", "utf8");
const timelinePage = readFileSync("src/app/research/timeline/page.tsx", "utf8");
const comparePage = readFileSync("src/app/research/compare/page.tsx", "utf8");
const debatePage = readFileSync("src/app/research/debate/[argumentId]/page.tsx", "utf8");
const foundryRoute = readFileSync("src/app/api/admin/knowledge-advanced/[[...path]]/route.ts", "utf8");
const foundryClient = readFileSync("src/lib/server/advancedKnowledgeAdmin.ts", "utf8");
const foundryUi = readFileSync("src/components/author/KnowledgeFoundryAdvanced.tsx", "utf8");

test("advanced public Knowledge routes remain read-only, canonical, and bounded", () => {
  assert.match(publicProxy, /compare\/advanced/);
  assert.match(publicProxy, /"debate"/);
  assert.match(publicProxy, /path === "timeline"/);
  assert.match(publicProxy, /Math\.min\(200/);
  assert.match(publicProxy, /Math\.min\(120/);
  assert.doesNotMatch(publicProxy, /export async function (POST|PATCH|PUT|DELETE)/);
});

test("Timeline explicitly excludes invented chronology", () => {
  assert.match(timelinePage, /Undated records are excluded rather than assigned invented chronology/);
  assert.match(timelinePage, /No explicitly dated published event nodes matched/);
  assert.match(timelinePage, /fetchKnowledgeEngine\("\/knowledge\/timeline"/);
});

test("Compare and Debate disclose their stored published relationship boundary", () => {
  assert.match(comparePage, /Only stored published relationships/);
  assert.match(comparePage, /fetchKnowledgeEngine\("\/knowledge\/compare\/advanced"/);
  assert.match(comparePage, /Stored relationships only/);
  assert.match(debatePage, /Unpublished response branches are excluded server-side/);
  assert.match(debatePage, /No truth score/);
  assert.match(debatePage, /fetchKnowledgeEngine\(`\/knowledge\/debate\//);
});

test("Knowledge Foundry admin bridge keeps credentials server-side and enforces normal web controls", () => {
  assert.match(foundryRoute, /readSessionCookie/);
  assert.match(foundryRoute, /isSessionFreshForUser/);
  assert.match(foundryRoute, /verifyCsrfToken/);
  assert.match(foundryRoute, /checkAdminMutationRateLimit/);
  assert.match(foundryRoute, /hasAnyPermission/);
  assert.doesNotMatch(foundryRoute, /ENGINE_ADMIN_TOKEN/);
  assert.match(foundryClient, /process\.env\.ENGINE_ADMIN_TOKEN/);
  assert.match(foundryClient, /"x-admin-token": token/);
  assert.match(foundryClient, /"x-editor-id": options\.editorId/);
  assert.match(foundryClient, /redirect: "error"/);
  assert.match(foundryClient, /response\.body\.getReader\(\)/);
});

test("authoring assistance stays proposal-only and acceptance requires governed draft revisions", () => {
  assert.match(foundryUi, /Auto-publish off/);
  assert.match(foundryUi, /Human review required/);
  assert.match(foundryUi, /Acceptance requires at least one current unpublished governed revision ID/);
  assert.match(foundryUi, /Accept evidence linkage/);
  assert.doesNotMatch(foundryUi, /autoPublish:\s*true/);
  assert.doesNotMatch(foundryUi, /autoMerge:\s*true/);
});
