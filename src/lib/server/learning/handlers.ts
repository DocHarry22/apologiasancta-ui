import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getClientIp, checkAdminMutationRateLimit } from "@/lib/auth/rateLimit";
import type { AdminEntityName } from "@/lib/learning/contracts";
import {
  parseAdminEntity,
  parseBookmarkInput,
  parseMasteryStartInput,
  parseMasterySubmitInput,
  parseOptionalUuid,
  parsePagination,
  parsePrerequisiteKind,
  parseSearchTerm,
  parseSlug,
  parseUuid,
  parseWorkflowAction,
  LearningValidationError,
  isRecord,
} from "@/lib/learning/validation";
import {
  bulkImportAdminEntities,
  bulkImportPrerequisites,
  createAdminEntity,
  createPrerequisite,
  deleteAdminEntity,
  deletePrerequisite,
  getAdminEntity,
  getPrerequisite,
  listAdminEntities,
  listPublicationCalendar,
  reorderAdminEntities,
  transitionAdminWorkflow,
  updateAdminEntity,
  updatePrerequisite,
  workflowPermission,
} from "./adminRepository";
import { requireLearnerContext, requireStaffContext } from "./auth";
import { getAdminGovernanceValidation } from "./governanceRepository";
import { engineQuestionsResponse } from "./engineFeed";
import { LearningApiError } from "./errors";
import {
  deleteBookmark,
  getLearnerProgress,
  listBookmarks,
  listMasteryAttempts,
  listReviewRecommendations,
  listUnlocks,
  saveBookmark,
  startMasteryAttempt,
  submitMasteryAttempt,
  updateLessonProgress,
} from "./learnerRepository";
import {
  checkPracticeAnswer,
  getPublicProgressPreview,
  getPublishedGroup,
  getPublishedLesson,
  getPublishedProgramme,
  getPublishedSubject,
  listPracticeQuestions,
  listPublishedProgrammes,
  searchPublishedContent,
} from "./publicRepository";
import { dataResponse, noStore, readJsonObject, withLearningApiErrors } from "./responses";
import { parseLessonProgressInput } from "@/lib/learning/validation";

function pageMeta(page: { limit: number; offset: number }, total: number) {
  return {
    limit: page.limit,
    offset: page.offset,
    total,
    hasMore: page.offset + page.limit < total,
  };
}

function cachePublic(response: ReturnType<typeof dataResponse>) {
  response.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  response.headers.set("Vary", "Accept-Encoding");
  return response;
}

function idempotencyHeader(request: NextRequest): string | null {
  return request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key");
}

function requestId(request: NextRequest): string {
  return request.headers.get("x-request-id")?.slice(0, 256) || randomUUID();
}

function enforceMutationRateLimit(request: NextRequest): void {
  const result = checkAdminMutationRateLimit(getClientIp(request));
  if (!result.allowed) {
    throw new LearningApiError(
      "rate_limited",
      429,
      `Too many requests. Try again in ${result.retryAfterSeconds ?? 60} seconds.`,
    );
  }
}

export function programmesRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const page = parsePagination(request.nextUrl.searchParams);
    const result = await listPublishedProgrammes(page);
    return cachePublic(dataResponse(result.data, { meta: pageMeta(page, result.total) }));
  });
}

export function programmeRoute(request: NextRequest, slugValue: string) {
  return withLearningApiErrors(request, async () => cachePublic(dataResponse(await getPublishedProgramme(parseSlug(slugValue)))));
}

export function subjectRoute(request: NextRequest, slugValue: string) {
  return withLearningApiErrors(request, async () => cachePublic(dataResponse(await getPublishedSubject(parseSlug(slugValue)))));
}

export function groupRoute(request: NextRequest, slugValue: string) {
  return withLearningApiErrors(request, async () => cachePublic(dataResponse(await getPublishedGroup(parseSlug(slugValue)))));
}

export function lessonRoute(request: NextRequest, slugValue: string) {
  return withLearningApiErrors(request, async () => cachePublic(dataResponse(await getPublishedLesson(parseSlug(slugValue)))));
}

export function searchRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const page = parsePagination(request.nextUrl.searchParams);
    const query = parseSearchTerm(request.nextUrl.searchParams.get("q"));
    const rawType = request.nextUrl.searchParams.get("type");
    const contentType = rawType && ["programme", "subject", "group", "lesson"].includes(rawType) ? rawType : null;
    if (rawType && !contentType) throw new LearningValidationError("The content type filter is invalid.");
    const difficulty = request.nextUrl.searchParams.get("difficulty")?.trim().slice(0, 80) || null;
    const result = await searchPublishedContent({ query, contentType, difficulty, page });
    return cachePublic(dataResponse(result.data, { meta: pageMeta(page, result.total) }));
  });
}

export function practiceRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const page = parsePagination(request.nextUrl.searchParams);
    const rawDifficulty = request.nextUrl.searchParams.get("difficulty");
    const difficulty = rawDifficulty === null || rawDifficulty === "" ? null : Number(rawDifficulty);
    if (difficulty !== null && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) {
      throw new LearningValidationError("The difficulty filter must be an integer from 1 to 5.");
    }
    const result = await listPracticeQuestions({
      subjectId: parseOptionalUuid(request.nextUrl.searchParams.get("subjectId"), "subjectId"),
      groupId: parseOptionalUuid(request.nextUrl.searchParams.get("groupId"), "groupId"),
      lessonId: parseOptionalUuid(request.nextUrl.searchParams.get("lessonId"), "lessonId"),
      difficulty,
      page,
    });
    return cachePublic(dataResponse(result.data, { meta: pageMeta(page, result.total) }));
  });
}

export function practiceCheckRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const body = await readJsonObject(request);
    const questionId = parseUuid(body.questionId ?? body.question_id, "questionId");
    const optionId = parseUuid(body.optionId ?? body.option_id, "optionId");
    return noStore(dataResponse(await checkPracticeAnswer(questionId, optionId)));
  });
}

export function progressPreviewRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => cachePublic(dataResponse(await getPublicProgressPreview())));
}

export function progressRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const auth = await requireLearnerContext(request);
    if (!auth.ok) return auth.response;
    return noStore(dataResponse({
      profile: auth.context.learner,
      ...await getLearnerProgress(auth.context.learner.id),
    }));
  });
}

export function lessonProgressRoute(request: NextRequest, lessonIdValue: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const auth = await requireLearnerContext(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const lessonId = parseUuid(lessonIdValue, "lessonId");
    const input = parseLessonProgressInput(await readJsonObject(request));
    return noStore(dataResponse(await updateLessonProgress(auth.context.learner.id, lessonId, input)));
  });
}

export function bookmarksGetRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const auth = await requireLearnerContext(request);
    if (!auth.ok) return auth.response;
    const page = parsePagination(request.nextUrl.searchParams);
    const result = await listBookmarks(auth.context.learner.id, page);
    return noStore(dataResponse(result.data, { meta: pageMeta(page, result.total) }));
  });
}

export function bookmarksPostRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const auth = await requireLearnerContext(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const input = parseBookmarkInput(await readJsonObject(request));
    return noStore(dataResponse(await saveBookmark(auth.context.learner.id, input), { status: 201 }));
  });
}

export function bookmarksDeleteRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const auth = await requireLearnerContext(request, { mutation: true });
    if (!auth.ok) return auth.response;

    let bookmarkIdValue: unknown = request.nextUrl.searchParams.get("id");
    let lessonIdValue: unknown = request.nextUrl.searchParams.get("lessonId");
    let sectionIdValue: unknown = request.nextUrl.searchParams.get("sectionId");
    if (!bookmarkIdValue && !lessonIdValue) {
      const body = await readJsonObject(request);
      bookmarkIdValue = body.id ?? body.bookmarkId ?? body.bookmark_id;
      lessonIdValue = body.lessonId ?? body.lesson_id;
      sectionIdValue = body.sectionId ?? body.section_id;
    }
    const selector = bookmarkIdValue
      ? { bookmarkId: parseUuid(bookmarkIdValue, "id") }
      : {
        lessonId: parseUuid(lessonIdValue, "lessonId"),
        sectionId: parseOptionalUuid(sectionIdValue, "sectionId"),
      };
    const deleted = await deleteBookmark(auth.context.learner.id, selector);
    if (!deleted) throw new LearningApiError("not_found", 404, "Bookmark was not found.");
    return noStore(dataResponse({ deleted: true }));
  });
}

export function masteryAttemptsGetRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const auth = await requireLearnerContext(request);
    if (!auth.ok) return auth.response;
    const page = parsePagination(request.nextUrl.searchParams);
    const groupId = parseOptionalUuid(request.nextUrl.searchParams.get("groupId"), "groupId");
    const result = await listMasteryAttempts(auth.context.learner.id, { groupId, page });
    return noStore(dataResponse(result.data, { meta: pageMeta(page, result.total) }));
  });
}

export function masteryAttemptsPostRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const auth = await requireLearnerContext(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const input = parseMasteryStartInput(await readJsonObject(request), idempotencyHeader(request));
    return noStore(dataResponse(await startMasteryAttempt(auth.context.learner.id, input), { status: 201 }));
  });
}

export function masterySubmitRoute(request: NextRequest, attemptIdValue: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const auth = await requireLearnerContext(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const attemptId = parseUuid(attemptIdValue, "attemptId");
    const input = parseMasterySubmitInput(await readJsonObject(request), idempotencyHeader(request));
    return noStore(dataResponse(await submitMasteryAttempt(auth.context.learner.id, attemptId, input)));
  });
}

export function unlocksRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const auth = await requireLearnerContext(request);
    if (!auth.ok) return auth.response;
    return noStore(dataResponse(await listUnlocks(auth.context.learner.id)));
  });
}

export function recommendationsRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const auth = await requireLearnerContext(request);
    if (!auth.ok) return auth.response;
    const page = parsePagination(request.nextUrl.searchParams);
    const result = await listReviewRecommendations(auth.context.learner.id, page);
    return noStore(dataResponse(result.data, { meta: pageMeta(page, result.total) }));
  });
}

export function engineQuestionsRoute(request: NextRequest) {
  return withLearningApiErrors(request, () => engineQuestionsResponse(request));
}

function staffReadPermission(entity: AdminEntityName) {
  return entity === "audit" ? "learning:audit" as const : "learning:view" as const;
}

function prerequisiteKindFromRequest(request: NextRequest, body?: Record<string, unknown>) {
  return parsePrerequisiteKind(body?.kind ?? request.nextUrl.searchParams.get("kind"));
}

function optionalPrerequisiteKind(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("kind");
  return value ? parsePrerequisiteKind(value) : undefined;
}

function isMutableAdminEntity(
  entity: AdminEntityName,
): entity is Exclude<AdminEntityName, "prerequisites" | "workflow" | "audit"> {
  return entity !== "prerequisites" && entity !== "workflow" && entity !== "audit";
}

export function adminCollectionGetRoute(request: NextRequest, entityValue: string) {
  return withLearningApiErrors(request, async () => {
    const entity = parseAdminEntity(entityValue);
    const auth = await requireStaffContext(request, staffReadPermission(entity));
    if (!auth.ok) return auth.response;
    const page = parsePagination(request.nextUrl.searchParams);
    const query = parseSearchTerm(request.nextUrl.searchParams.get("q"));
    const status = request.nextUrl.searchParams.get("status")?.trim().slice(0, 80) || null;
    const parentId = request.nextUrl.searchParams.get("parentId") || null;
    const prerequisiteKind = entity === "prerequisites" ? optionalPrerequisiteKind(request) : undefined;
    const result = await listAdminEntities({ entity, page, query, status, parentId, prerequisiteKind });
    return noStore(dataResponse(result.data, { meta: pageMeta(page, result.total) }));
  });
}

export function adminCollectionPostRoute(request: NextRequest, entityValue: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const entity = parseAdminEntity(entityValue);
    const auth = await requireStaffContext(request, "learning:manage", { mutation: true });
    if (!auth.ok) return auth.response;
    if (["audit", "workflow"].includes(entity)) {
      throw new LearningApiError("method_not_allowed", 405, "This learning resource is read-only.");
    }
    if (entity === "prerequisites" && ["author", "contributor"].includes(auth.context.user.role)) {
      throw new LearningApiError("forbidden", 403, "Prerequisite management requires editor access.");
    }
    const body = await readJsonObject(request);
    const data = entity === "prerequisites"
      ? await createPrerequisite({
        kind: prerequisiteKindFromRequest(request, body),
        body,
        actorId: auth.context.user.id,
        requestId: requestId(request),
      })
      : await createAdminEntity({
        entity,
        body,
        actorId: auth.context.user.id,
        requestId: requestId(request),
      });
    return noStore(dataResponse(data, { status: 201 }));
  });
}

export function adminItemGetRoute(request: NextRequest, entityValue: string, id: string) {
  return withLearningApiErrors(request, async () => {
    const entity = parseAdminEntity(entityValue);
    const auth = await requireStaffContext(request, staffReadPermission(entity));
    if (!auth.ok) return auth.response;
    const data = entity === "prerequisites"
      ? await getPrerequisite(prerequisiteKindFromRequest(request), id)
      : await getAdminEntity(entity, id);
    return noStore(dataResponse(data));
  });
}

export function adminItemPatchRoute(request: NextRequest, entityValue: string, id: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const entity = parseAdminEntity(entityValue);
    const auth = await requireStaffContext(request, "learning:manage", { mutation: true });
    if (!auth.ok) return auth.response;
    if (["audit", "workflow"].includes(entity)) {
      throw new LearningApiError("method_not_allowed", 405, "This learning resource is read-only.");
    }
    if (entity === "prerequisites" && ["author", "contributor"].includes(auth.context.user.role)) {
      throw new LearningApiError("forbidden", 403, "Prerequisite management requires editor access.");
    }
    const body = await readJsonObject(request);
    const data = entity === "prerequisites"
      ? await updatePrerequisite({
        kind: prerequisiteKindFromRequest(request, body), id, body,
        actorId: auth.context.user.id, requestId: requestId(request),
      })
      : await updateAdminEntity({
        entity, id, body,
        actor: { id: auth.context.user.id, role: auth.context.user.role },
        requestId: requestId(request),
      });
    return noStore(dataResponse(data));
  });
}

export function adminItemDeleteRoute(request: NextRequest, entityValue: string, id: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const entity = parseAdminEntity(entityValue);
    const auth = await requireStaffContext(request, "learning:publish", { mutation: true });
    if (!auth.ok) return auth.response;
    if (["audit", "workflow"].includes(entity)) {
      throw new LearningApiError("method_not_allowed", 405, "This learning resource is read-only.");
    }
    const data = entity === "prerequisites"
      ? await deletePrerequisite({
        kind: prerequisiteKindFromRequest(request), id,
        actorId: auth.context.user.id, requestId: requestId(request),
      })
      : await deleteAdminEntity({
        entity, id, actorId: auth.context.user.id, requestId: requestId(request),
      });
    return noStore(dataResponse(data));
  });
}

export function adminGovernanceValidationRoute(request: NextRequest, id: string) {
  return withLearningApiErrors(request, async () => {
    const auth = await requireStaffContext(request, "learning:view");
    if (!auth.ok) return auth.response;
    const entity = parseAdminEntity(request.nextUrl.searchParams.get("entity") ?? "");
    const forPublication = request.nextUrl.searchParams.get("forPublication") === "true";
    return noStore(dataResponse(await getAdminGovernanceValidation({
      entity,
      id,
      forPublication,
    })));
  });
}

export function adminWorkflowRoute(request: NextRequest, id: string, actionValue: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const action = parseWorkflowAction(actionValue);
    const auth = await requireStaffContext(request, workflowPermission(action), { mutation: true });
    if (!auth.ok) return auth.response;
    const body = await readJsonObject(request);
    return noStore(dataResponse(await transitionAdminWorkflow({
      id,
      action,
      body,
      actor: { id: auth.context.user.id, role: auth.context.user.role },
      requestId: requestId(request),
    })));
  });
}

export function adminEntityWorkflowRoute(
  request: NextRequest,
  entityValue: string,
  id: string,
  actionValue: string,
) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const entity = parseAdminEntity(entityValue);
    if (["prerequisites", "workflow", "audit", "question-options", "question-contexts", "content-sources"].includes(entity)) {
      throw new LearningApiError("invalid_request", 400, "This learning resource does not support publication workflow.");
    }
    const action = parseWorkflowAction(actionValue);
    const auth = await requireStaffContext(request, workflowPermission(action), { mutation: true });
    if (!auth.ok) return auth.response;
    const body = await readJsonObject(request);
    return noStore(dataResponse(await transitionAdminWorkflow({
      id,
      action,
      body: { ...body, entity },
      actor: { id: auth.context.user.id, role: auth.context.user.role },
      requestId: requestId(request),
    })));
  });
}

export function adminReorderRoute(request: NextRequest, entityValue: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const entity = parseAdminEntity(entityValue);
    if (!isMutableAdminEntity(entity)) {
      throw new LearningApiError("method_not_allowed", 405, "This learning resource cannot be reordered.");
    }
    const auth = await requireStaffContext(request, "learning:manage", { mutation: true });
    if (!auth.ok) return auth.response;
    if (["author", "contributor"].includes(auth.context.user.role)) {
      throw new LearningApiError("forbidden", 403, "This action requires editor access.");
    }
    const body = await readJsonObject(request);
    if (!Array.isArray(body.items)) throw new LearningValidationError("A reorder item list is required.");
    const items = body.items.map((item, index) => {
      if (!isRecord(item)) {
        throw new LearningValidationError("A reorder item is invalid.", { [`items.${index}`]: "Expected an object" });
      }
      return {
        id: parseUuid(item.id, `items.${index}.id`),
        displayOrder: Number(item.displayOrder ?? item.display_order),
      };
    });
    return noStore(dataResponse(await reorderAdminEntities({
      entity,
      items,
      actorId: auth.context.user.id,
      requestId: requestId(request),
    })));
  });
}

export function adminImportRoute(request: NextRequest, entityValue: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const entity = parseAdminEntity(entityValue);
    if (entity === "workflow" || entity === "audit") {
      throw new LearningApiError("method_not_allowed", 405, "This learning resource cannot be imported in bulk.");
    }
    const auth = await requireStaffContext(request, "learning:manage", { mutation: true });
    if (!auth.ok) return auth.response;
    if (entity === "prerequisites" && ["author", "contributor"].includes(auth.context.user.role)) {
      throw new LearningApiError("forbidden", 403, "Prerequisite management requires editor access.");
    }
    const body = await readJsonObject(request);
    if (body.dryRun === true) {
      throw new LearningApiError("dry_run_unsupported", 400, "Dry-run imports are not available on this endpoint.");
    }
    const records = body.records ?? body.items;
    if (!Array.isArray(records) || records.length < 1 || records.length > 100 || !records.every(isRecord)) {
      throw new LearningValidationError("An import must contain 1-100 object records.");
    }
    const data = entity === "prerequisites"
      ? await bulkImportPrerequisites({
        records,
        actorId: auth.context.user.id,
        requestId: requestId(request),
      })
      : await bulkImportAdminEntities({
        entity,
        records,
        actorId: auth.context.user.id,
        requestId: requestId(request),
      });
    return noStore(dataResponse(data, { status: 201, meta: { imported: data.length } }));
  });
}

export function adminExportRoute(request: NextRequest, entityValue: string) {
  return withLearningApiErrors(request, async () => {
    const entity = parseAdminEntity(entityValue);
    const auth = await requireStaffContext(request, staffReadPermission(entity));
    if (!auth.ok) return auth.response;
    const page = parsePagination(request.nextUrl.searchParams);
    const prerequisiteKind = entity === "prerequisites" ? optionalPrerequisiteKind(request) : undefined;
    const result = await listAdminEntities({
      entity,
      page,
      query: "",
      status: request.nextUrl.searchParams.get("status")?.slice(0, 80) || null,
      parentId: request.nextUrl.searchParams.get("parentId"),
      prerequisiteKind,
    });
    return noStore(dataResponse(result.data, {
      meta: { ...pageMeta(page, result.total), exportedAt: new Date().toISOString() },
      headers: { "Content-Disposition": `attachment; filename="learning-${entity}.json"` },
    }));
  });
}

export function adminCalendarRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const auth = await requireStaffContext(request, "learning:view");
    if (!auth.ok) return auth.response;
    const page = parsePagination(request.nextUrl.searchParams);
    const result = await listPublicationCalendar(page);
    return noStore(dataResponse(result.data, { meta: pageMeta(page, result.total) }));
  });
}
