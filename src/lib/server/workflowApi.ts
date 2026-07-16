import type { NextRequest } from "next/server";
import { listPublishedQuestionRecords, listTopicsWithCounts } from "@/lib/content";
import { getClientIp } from "@/lib/auth/rateLimit";
import { appendAuditEvent } from "./storage/auditStore";
import {
  completeWorkflowPublication,
  createWorkflowDraft,
  failWorkflowPublication,
  getWorkflowItem,
  listWorkflowItems,
  prepareWorkflowPublication,
  transitionWorkflowItem,
  updateWorkflowDraft,
  WorkflowConflictError,
  WorkflowPublicationError,
  WorkflowValidationError,
} from "./storage/workflowStore";
import { canCreateWorkflow, canEditWorkflowItem, canPublishWorkflowItem, canReviewWorkflowItem, canSubmitWorkflowItem, canViewWorkflowItem } from "../workflowPermissions";
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
    return workflowErrorResponse("create", error);
  }
  await appendSecondaryAudit("create", {
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
    return workflowErrorResponse("update", error);
  }
  await appendSecondaryAudit("update", {
    actor: auth.user,
    eventType: "workflow.update",
    action: "Update workflow draft",
    resourceType: "workflow_item",
    resourceId: updated.id,
    method: request.method,
    path: request.nextUrl.pathname,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    metadata: {
      questionId: updated.questionId,
      topicId: updated.topicId,
      revisionId: updated.currentRevisionId,
      contentHash: updated.contentHash,
    },
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

  if (nextStatus === "published") {
    let claim;
    try {
      claim = await prepareWorkflowPublication(item.id, auth.user, topicIds, existingIds);
    } catch (error) {
      return workflowErrorResponse("prepare_publication", error);
    }
    if (claim.alreadyCompleted) {
      return safeJson({ ok: true, item: claim.item, publishTarget: claim.item.publishTarget, idempotentReplay: true });
    }

    const result: EnginePublishResult = await publishQuestionToEngine(claim.question, claim.idempotencyKey);
    if (!result.ok) {
      try {
        await failWorkflowPublication(claim, auth.user, result.error);
      } catch {
        // The durable processing lease still makes a later retry safe when the
        // database is temporarily unavailable while recording this failure.
      }
      await appendSecondaryAudit("publication_failure", {
        actor: auth.user,
        eventType,
        action: "Workflow publication failed",
        resourceType: "workflow_item",
        resourceId: item.id,
        method: request.method,
        path: request.nextUrl.pathname,
        status: "failure",
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? undefined,
        metadata: { questionId: item.questionId, topicId: item.topicId, contentHash: claim.item.contentHash },
        severity: "error",
      });
      return safeJson({ ok: false, error: result.error }, result.status >= 400 && result.status <= 599 ? result.status : 502);
    }

    let updated;
    try {
      updated = await completeWorkflowPublication(claim, auth.user, {
        added: result.data.added,
        updated: result.data.updated,
        bankSize: result.data.bankSize,
        activePoolRefreshed: result.data.activePoolRefreshed === true,
      });
    } catch {
      try {
        await failWorkflowPublication(claim, auth.user, "Engine accepted the revision, but local publication completion must be retried.");
      } catch {
        // Preserve the processing lease for a safe exact-revision retry.
      }
      return safeJson({
        ok: false,
        error: "Engine accepted the exact revision, but publication confirmation could not be stored. Retry after the publication lease expires.",
      }, 503);
    }

    try {
      await appendSecondaryAudit("publication_success", {
        actor: auth.user,
        eventType,
        action: "Workflow published",
        resourceType: "workflow_item",
        resourceId: updated.id,
        method: request.method,
        path: request.nextUrl.pathname,
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? undefined,
        metadata: {
          questionId: updated.questionId,
          topicId: updated.topicId,
          publishTarget: updated.publishTarget,
          contentHash: updated.contentHash,
          engineBankSize: result.data.bankSize,
        },
      });
    } catch {
      // The transactional workflow event is the durable publication audit.
      // A secondary audit-feed failure must not turn a completed publish into
      // a false failure response that encourages unnecessary retries.
    }
    return safeJson({ ok: true, item: updated, publishTarget: updated.publishTarget, publishResult: result.data });
  }

  try {
    const updated = await transitionWorkflowItem(item.id, nextStatus, auth.user, {
      comment: typeof body.comment === "string" ? body.comment : undefined,
      doctrinalFlag: body.doctrinalFlag === true,
      referenceFlag: body.referenceFlag === true,
      attestation: body.attestation,
      topicIds,
      existingIds,
    });
    await appendSecondaryAudit(`transition_${nextStatus}`, {
      actor: auth.user,
      eventType,
      action: `Workflow ${nextStatus.replace("_", " ")}`,
      resourceType: "workflow_item",
      resourceId: updated.id,
      method: request.method,
      path: request.nextUrl.pathname,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: {
        questionId: updated.questionId,
        topicId: updated.topicId,
        revisionId: updated.currentRevisionId,
        contentHash: updated.contentHash,
      },
    });
    return safeJson({ ok: true, item: updated });
  } catch (error) {
    return workflowErrorResponse(`transition_${nextStatus}`, error);
  }
}

function errorClass(error: unknown): string {
  return error instanceof Error && /^[A-Za-z0-9_]+$/.test(error.name) ? error.name : "UnknownError";
}

function logWorkflowInfrastructureError(operation: string, error: unknown): void {
  console.error(JSON.stringify({ event: "workflow_infrastructure_error", operation, errorClass: errorClass(error) }));
}

function workflowErrorResponse(operation: string, error: unknown) {
  if (error instanceof WorkflowValidationError) return safeJson({ ok: false, error: error.message }, 400);
  if (error instanceof WorkflowConflictError || error instanceof WorkflowPublicationError) return safeJson({ ok: false, error: error.message }, 409);
  logWorkflowInfrastructureError(operation, error);
  return safeJson({ ok: false, error: "Editorial workflow storage is temporarily unavailable." }, 503);
}

async function appendSecondaryAudit(operation: string, input: Parameters<typeof appendAuditEvent>[0]): Promise<void> {
  try {
    await appendAuditEvent(input);
  } catch (error) {
    logWorkflowInfrastructureError(`${operation}.secondary_audit`, error);
  }
}
