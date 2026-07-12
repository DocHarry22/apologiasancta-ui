import type { NextRequest } from "next/server";
import { listPublishedQuestionRecords, listTopicsWithCounts } from "@/lib/content";
import { getClientIp } from "@/lib/auth/rateLimit";
import { appendAuditEvent } from "./storage/auditStore";
import { createWorkflowDraft, getWorkflowItem, listWorkflowItems, transitionWorkflowItem, updateWorkflowDraft, WorkflowConflictError } from "./storage/workflowStore";
import { canCreateWorkflow, canEditWorkflowItem, canPublishWorkflowItem, canReviewWorkflowItem, canSubmitWorkflowItem, canViewWorkflowItem } from "./workflowPermissions";
import { forbidden, readJsonBody, requireAuthorSession, requireCsrf, safeJson } from "./apiAuth";
import type { AuditEventType } from "./storage/types";
import type { ReviewStatus } from "@/lib/contentWorkflow";
import { publishQuestionToEngine, type EnginePublishResult } from "./engineProxy";

async function contentContext() {
  const [topics, published] = await Promise.all([listTopicsWithCounts(), listPublishedQuestionRecords()]);
  return {
    topicIds: topics.map((topic) => topic.id),
    existingIds: published.map((record) => record.question.id),
  };
}

export async function listWorkflowRoute(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  const query = request.nextUrl.searchParams;
  const items = await listWorkflowItems({
    status: query.get("status") || undefined,
    topicId: query.get("topicId") || undefined,
    authorId: query.get("authorId") || undefined,
    reviewerId: query.get("reviewerId") || undefined,
    search: query.get("search") || undefined,
  });
  return safeJson({ ok: true, items: items.filter((item) => canViewWorkflowItem(auth.user.role, auth.user.id, item)) });
}

export async function createWorkflowRoute(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;
  const csrf = await requireCsrf(request, auth.user);
  if (csrf) return csrf;
  if (!canCreateWorkflow(auth.user.role)) return forbidden(request, auth.user, "missing workflow create permission");

  const body = await readJsonBody(request);
  const question = (body.question && typeof body.question === "object" ? body.question : body) as Record<string, unknown>;
  const submit = body.status === "submitted" || body.submit === true;
  const { topicIds, existingIds } = await contentContext();
  let item;
  try {
    item = await createWorkflowDraft(question, auth.user, topicIds, existingIds, submit);
  } catch (error) {
    return safeJson({ ok: false, error: error instanceof Error ? error.message : "Unable to create workflow item" }, error instanceof WorkflowConflictError ? 409 : 400);
  }
  await appendAuditEvent({
    actor: auth.user,
    eventType: submit ? "workflow.submit" : "workflow.create",
    action: submit ? "Create and submit workflow item" : "Create workflow draft",
    resourceType: "workflow_item",
    resourceId: item.id,
    method: request.method,
    path: request.nextUrl.pathname,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    metadata: { questionId: item.questionId, topicId: item.topicId },
  });
  return safeJson({ ok: true, item }, 201);
}

export async function getWorkflowRoute(request: NextRequest, id: string) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;
  const item = await getWorkflowItem(id);
  if (!item) return safeJson({ ok: false, error: "Workflow item not found" }, 404);
  if (!canViewWorkflowItem(auth.user.role, auth.user.id, item)) return forbidden(request, auth.user, "workflow item not visible");
  return safeJson({ ok: true, item });
}

export async function patchWorkflowRoute(request: NextRequest, id: string) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;
  const csrf = await requireCsrf(request, auth.user);
  if (csrf) return csrf;

  const item = await getWorkflowItem(id);
  if (!item) return safeJson({ ok: false, error: "Workflow item not found" }, 404);
  if (!canEditWorkflowItem(auth.user.role, auth.user.id, item)) return forbidden(request, auth.user, "workflow item cannot be edited");

  const body = await readJsonBody(request);
  const question = (body.question && typeof body.question === "object" ? body.question : body) as Record<string, unknown>;
  const { topicIds, existingIds } = await contentContext();
  let updated;
  try {
    updated = await updateWorkflowDraft(item.id, question, auth.user, topicIds, existingIds);
  } catch (error) {
    return safeJson({ ok: false, error: error instanceof Error ? error.message : "Unable to update workflow item" }, error instanceof WorkflowConflictError ? 409 : 400);
  }
  await appendAuditEvent({
    actor: auth.user,
    eventType: "workflow.update",
    action: "Update workflow draft",
    resourceType: "workflow_item",
    resourceId: updated.id,
    method: request.method,
    path: request.nextUrl.pathname,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    metadata: { questionId: updated.questionId, topicId: updated.topicId },
  });
  return safeJson({ ok: true, item: updated });
}

export async function transitionWorkflowRoute(request: NextRequest, id: string, nextStatus: ReviewStatus, eventType: AuditEventType) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;
  const csrf = await requireCsrf(request, auth.user);
  if (csrf) return csrf;

  const item = await getWorkflowItem(id);
  if (!item) return safeJson({ ok: false, error: "Workflow item not found" }, 404);
  if (nextStatus === "submitted" && !canSubmitWorkflowItem(auth.user.role, auth.user.id, item)) {
    return forbidden(request, auth.user, "workflow item cannot be submitted");
  }
  if (["approved", "rejected", "changes_requested"].includes(nextStatus) && !canReviewWorkflowItem(auth.user.role, auth.user.id, item)) {
    return forbidden(request, auth.user, "workflow item cannot be reviewed");
  }
  if (nextStatus === "published" && !canPublishWorkflowItem(auth.user.role)) {
    return forbidden(request, auth.user, "missing content:publish");
  }
  if (nextStatus === "archived" && !(canEditWorkflowItem(auth.user.role, auth.user.id, item) || auth.user.role === "admin" || auth.user.role === "super_admin")) {
    return forbidden(request, auth.user, "workflow item cannot be archived");
  }

  const body = await readJsonBody(request);
  const { topicIds, existingIds } = await contentContext();
  let enginePublish: Extract<EnginePublishResult, { ok: true }> | undefined;
  if (nextStatus === "published") {
    const result = await publishQuestionToEngine({
      id: item.questionId,
      topicId: item.topicId,
      difficulty: item.difficulty,
      question: item.question,
      choices: item.choices,
      correctId: item.correctId,
      teaching: item.teaching,
      tags: item.tags,
    });
    if (!result.ok) {
      return safeJson({ ok: false, error: result.error }, result.status >= 400 && result.status <= 599 ? result.status : 502);
    }
    enginePublish = result;
  }
  try {
    const updated = await transitionWorkflowItem(item.id, nextStatus, auth.user, {
      comment: typeof body.comment === "string" ? body.comment : undefined,
      doctrinalFlag: body.doctrinalFlag === true,
      referenceFlag: body.referenceFlag === true,
      topicIds,
      existingIds,
      publishTarget: nextStatus === "published" ? "engine" : undefined,
    });
    await appendAuditEvent({
      actor: auth.user,
      eventType,
      action: `Workflow ${nextStatus.replace("_", " ")}`,
      resourceType: "workflow_item",
      resourceId: updated.id,
      method: request.method,
      path: request.nextUrl.pathname,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: { questionId: updated.questionId, topicId: updated.topicId, publishTarget: updated.publishTarget, engineBankSize: enginePublish?.data.bankSize },
    });
    return safeJson({ ok: true, item: updated, publishTarget: updated.publishTarget, publishResult: enginePublish?.data });
  } catch (error) {
    return safeJson({ ok: false, error: error instanceof Error ? error.message : "Workflow transition failed" }, 400);
  }
}
