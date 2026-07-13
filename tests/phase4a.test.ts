import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("workflow store implements durable create, list, transitions, and publish validation", () => {
  const workflowStore = readFileSync("src/lib/server/storage/workflowStore.ts", "utf8");
  const jsonStore = readFileSync("src/lib/server/storage/jsonStore.ts", "utf8");
  const workflowPermissions = readFileSync("src/lib/server/workflowPermissions.ts", "utf8");

  assert.ok(workflowStore.includes('new JsonStore<WorkflowItem[]>("workflow-items.json", [])'));
  assert.ok(workflowStore.includes("createWorkflowDraft"));
  assert.ok(workflowStore.includes("listWorkflowItems"));
  assert.ok(workflowStore.includes("updateWorkflowDraft"));
  assert.ok(workflowStore.includes("transitionWorkflowItem"));
  assert.ok(workflowStore.includes('nextStatus === "published"'));
  assert.ok(workflowStore.includes("hasBlockingValidationIssues"));
  assert.ok(workflowStore.includes("workflowMutationQueue"));
  assert.ok(workflowStore.includes("assertUniqueQuestionId"));
  assert.ok(workflowStore.includes("WorkflowConflictError"));
  assert.ok(workflowStore.includes('!["submitted", "approved", "published"].includes(status)'));
  assert.ok(workflowStore.includes("A reviewer comment is required"));
  assert.ok(workflowStore.includes('publishTarget: nextStatus === "published" ? options.publishTarget ?? "workflow_store"'));
  assert.ok(jsonStore.includes("CREATE TABLE IF NOT EXISTS app_kv_store"));
  assert.ok(jsonStore.includes("ON CONFLICT (store_key) DO UPDATE"));
  assert.ok(jsonStore.includes("ON DUPLICATE KEY UPDATE"));
  assert.ok(jsonStore.includes("One-time migration path"));
  assert.ok(workflowPermissions.includes("item.authorId === userId"));
  assert.ok(workflowPermissions.includes("content:review"));
  assert.ok(workflowPermissions.includes("content:publish"));
});

test("audit store appends, filters, and redacts sensitive metadata", () => {
  const auditStore = readFileSync("src/lib/server/storage/auditStore.ts", "utf8");

  assert.ok(auditStore.includes('new JsonStore<AuditEvent[]>("audit-events.json", [])'));
  assert.ok(auditStore.includes("appendAuditEvent"));
  assert.ok(auditStore.includes("listAuditEvents"));
  assert.ok(auditStore.includes("sanitizeAuditMetadata"));
  assert.ok(auditStore.includes('"x-csrf-token"'));
  assert.ok(auditStore.includes('"[redacted]"'));
  assert.ok(auditStore.includes("events.unshift(event)"));
  assert.ok(auditStore.includes("auditMutationQueue"));
});

test("Phase 4A browser code does not reintroduce browser-side admin tokens or local workflow authority", () => {
  const dashboard = readFileSync("src/components/author/AuthorDashboardClient.tsx", "utf8");
  const adminProxyClient = readFileSync("src/lib/adminProxyClient.ts", "utf8");

  assert.equal(dashboard.includes("x-admin-token"), false);
  assert.equal(adminProxyClient.includes("x-admin-token"), false);
  assert.equal(dashboard.includes("localStorage"), false);
  assert.ok(dashboard.includes("/api/workflow/items"));
  assert.ok(dashboard.includes("/api/audit/events"));
});

test("workflow and audit routes enforce session, permissions, CSRF, and audit writes", () => {
  const apiAuth = readFileSync("src/lib/server/apiAuth.ts", "utf8");
  const workflowApi = readFileSync("src/lib/server/workflowApi.ts", "utf8");
  const itemsRoute = readFileSync("src/app/api/workflow/items/route.ts", "utf8");
  const auditRoute = readFileSync("src/app/api/audit/events/route.ts", "utf8");
  const meRoute = readFileSync("src/app/api/auth/me/route.ts", "utf8");
  const engineProxy = readFileSync("src/lib/server/engineProxy.ts", "utf8");

  assert.ok(apiAuth.includes("readSessionCookie"));
  assert.ok(apiAuth.includes("verifyCsrfToken"));
  assert.ok(apiAuth.includes("security.csrf_failed"));
  assert.ok(workflowApi.includes("requireAuthorSession"));
  assert.ok(workflowApi.includes("requireCsrf"));
  assert.ok(workflowApi.includes("appendAuditEvent"));
  assert.ok(workflowApi.includes("canReviewWorkflowItem"));
  assert.ok(workflowApi.includes("canPublishWorkflowItem"));
  assert.ok(workflowApi.includes("WorkflowConflictError"));
  assert.ok(workflowApi.includes("409"));
  assert.ok(workflowApi.includes("publishQuestionToEngine"));
  assert.ok(workflowApi.includes('publishTarget: nextStatus === "published" ? "engine"'));
  assert.ok(engineProxy.includes("publishQuestionToEngine"));
  assert.ok(engineProxy.includes('"x-admin-token": adminToken'));
  assert.ok(engineProxy.includes("refreshActivePool: false"));
  assert.ok(engineProxy.includes("commitToGitHub: false"));
  assert.ok(itemsRoute.includes("createWorkflowRoute"));
  assert.ok(auditRoute.includes("audit:view"));
  assert.ok(meRoute.includes("permissions"));
});
