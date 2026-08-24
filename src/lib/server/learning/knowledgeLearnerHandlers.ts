import type { NextRequest } from "next/server";
import { checkAdminMutationRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import { isRecord, parseUuid } from "@/lib/learning/validation";
import { requireLearnerContext } from "./auth";
import { LearningApiError } from "./errors";
import {
  createSavedKnowledgeJourney,
  deleteSavedKnowledgeJourney,
  getSharedKnowledgeJourney,
  isCanonicalKnowledgeId,
  listKnowledgeGapRecommendations,
  listSavedKnowledgeJourneys,
  type SavedJourneyInput,
  updateSavedKnowledgeJourney,
} from "./knowledgeLearnerRepository";
import { dataResponse, noStore, readJsonObject, withLearningApiErrors } from "./responses";

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

function boundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function boundedNumber(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function parseSavedJourneyInput(body: Record<string, unknown>): SavedJourneyInput {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 160) {
    throw new LearningApiError("validation_error", 400, "Journey title must be between 1 and 160 characters.");
  }

  const rootNodeId = body.rootNodeId ?? body.root_node_id;
  if (!isCanonicalKnowledgeId(rootNodeId)) {
    throw new LearningApiError("validation_error", 400, "rootNodeId must be a canonical Knowledge Engine ID.");
  }

  const rawNodes = body.nodeIds ?? body.node_ids;
  if (!Array.isArray(rawNodes) || rawNodes.length < 1 || rawNodes.length > 120) {
    throw new LearningApiError("validation_error", 400, "nodeIds must contain between 1 and 120 canonical IDs.");
  }
  const nodeIds = [...new Set(rawNodes.map((value) => {
    if (!isCanonicalKnowledgeId(value)) {
      throw new LearningApiError("validation_error", 400, "Every journey node must be a canonical Knowledge Engine ID.");
    }
    return value;
  }))];
  if (!nodeIds.includes(rootNodeId)) nodeIds.unshift(rootNodeId);
  if (nodeIds.length > 120) {
    throw new LearningApiError("validation_error", 400, "The journey exceeds the 120-node limit.");
  }

  const lens = typeof body.lens === "string" ? body.lens.trim().toLowerCase() : "catholic";
  if (!/^[a-z0-9_-]{1,80}$/.test(lens)) {
    throw new LearningApiError("validation_error", 400, "The journey lens is invalid.");
  }

  const visibility = typeof body.visibility === "string" ? body.visibility : "private";
  if (!new Set(["private", "unlisted", "public"]).has(visibility)) {
    throw new LearningApiError("validation_error", 400, "Journey visibility must be private, unlisted, or public.");
  }

  const metadata = isRecord(body.metadata) ? body.metadata : {};
  if (Buffer.byteLength(JSON.stringify(metadata), "utf8") > 16 * 1024) {
    throw new LearningApiError("validation_error", 400, "Journey metadata is too large.");
  }

  return {
    title,
    rootNodeId,
    nodeIds,
    lens,
    visibility: visibility as SavedJourneyInput["visibility"],
    metadata,
  };
}

export function knowledgeGapRecommendationsRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const auth = await requireLearnerContext(request);
    if (!auth.ok) return auth.response;
    const limit = boundedInt(request.nextUrl.searchParams.get("limit"), 12, 1, 50);
    const masteryBelow = boundedNumber(request.nextUrl.searchParams.get("masteryBelow"), 80, 1, 100);
    const recommendations = await listKnowledgeGapRecommendations(auth.context.learner.id, { limit, masteryBelow });
    return noStore(dataResponse(recommendations, {
      meta: {
        limit,
        masteryBelow,
        evidenceRequired: true,
        unseenConceptsExcluded: true,
        ranking: "mastery_ascending_then_evidence_descending",
      },
    }));
  });
}

export function savedJourneysGetRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    const auth = await requireLearnerContext(request);
    if (!auth.ok) return auth.response;
    const limit = boundedInt(request.nextUrl.searchParams.get("limit"), 50, 1, 100);
    return noStore(dataResponse(await listSavedKnowledgeJourneys(auth.context.learner.id, limit), { meta: { limit } }));
  });
}

export function savedJourneysPostRoute(request: NextRequest) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const auth = await requireLearnerContext(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const input = parseSavedJourneyInput(await readJsonObject(request));
    return noStore(dataResponse(await createSavedKnowledgeJourney(auth.context.learner.id, input), { status: 201 }));
  });
}

export function savedJourneyPatchRoute(request: NextRequest, journeyIdValue: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const auth = await requireLearnerContext(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const journeyId = parseUuid(journeyIdValue, "journeyId");
    const input = parseSavedJourneyInput(await readJsonObject(request));
    const journey = await updateSavedKnowledgeJourney(auth.context.learner.id, journeyId, input);
    if (!journey) throw new LearningApiError("not_found", 404, "Saved journey was not found.");
    return noStore(dataResponse(journey));
  });
}

export function savedJourneyDeleteRoute(request: NextRequest, journeyIdValue: string) {
  return withLearningApiErrors(request, async () => {
    enforceMutationRateLimit(request);
    const auth = await requireLearnerContext(request, { mutation: true });
    if (!auth.ok) return auth.response;
    const journeyId = parseUuid(journeyIdValue, "journeyId");
    const deleted = await deleteSavedKnowledgeJourney(auth.context.learner.id, journeyId);
    if (!deleted) throw new LearningApiError("not_found", 404, "Saved journey was not found.");
    return noStore(dataResponse({ deleted: true }));
  });
}

export function sharedJourneyRoute(request: NextRequest, shareTokenValue: string) {
  return withLearningApiErrors(request, async () => {
    const shareToken = parseUuid(shareTokenValue, "shareToken");
    const journey = await getSharedKnowledgeJourney(shareToken);
    if (!journey) throw new LearningApiError("not_found", 404, "Shared journey was not found.");
    const response = dataResponse(journey);
    response.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return response;
  });
}
