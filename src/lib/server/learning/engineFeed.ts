import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isRecord, isUuid } from "@/lib/learning/validation";
import { learningQuery } from "./database";
import { LearningApiError } from "./errors";

type EngineOption = {
  id: string;
  label: string;
};

type EngineSource = {
  authorityCategory: string;
  locator: string;
  citation: string;
  permissionStatus: string;
};

export type EngineQuestion = {
  id: string;
  version: number;
  topicId: string;
  subjectId?: string;
  groupId?: string;
  lessonId?: string;
  objectiveId: string;
  difficulty: number;
  difficultyMode: "easy" | "medium" | "hard" | "expert" | "trick";
  trickCategory?: string;
  equivalenceKey: string;
  questionType: "single_choice";
  prompt: string;
  options: EngineOption[];
  correctOptionId: string;
  explanation: string;
  optionExplanations: Record<string, string>;
  optionMisconceptionCodes: Record<string, string>;
  denominationScope: Record<string, unknown>;
  rightsMetadata: Record<string, unknown>;
  qualityFlags: Record<string, unknown>;
  sources: EngineSource[];
  governanceStage: "publication" | "analytics_review";
  governanceValidated: true;
  tags?: string[];
};

export type EngineFeed = {
  version: string;
  updatedAt: string;
  questions: EngineQuestion[];
};

function plainText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean).join("\n").trim();
  if (!isRecord(value)) return "";
  for (const key of ["text", "label", "prompt", "body", "content", "summary"]) {
    const text = plainText(value[key]);
    if (text) return text;
  }
  for (const key of ["children", "blocks", "paragraphs"]) {
    const text = plainText(value[key]);
    if (text) return text;
  }
  return "";
}

function optionalUuid(value: unknown): string | undefined {
  return isUuid(value) ? value : undefined;
}

function parseRecordArray(value: unknown, expectedLength?: number): Array<Record<string, unknown>> {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (!Array.isArray(parsed) || !parsed.every(isRecord) || (expectedLength !== undefined && parsed.length !== expectedLength)) {
    throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
  }
  return parsed;
}

function parseOptions(value: unknown): Array<Record<string, unknown>> {
  return [...parseRecordArray(value, 4)].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
}

export function buildEngineFeed(rows: Record<string, unknown>[]): EngineFeed {
  let latestTimestamp = 0;
  const questions = rows.map((row): EngineQuestion => {
    const id = row.question_id;
    const subjectId = optionalUuid(row.subject_id);
    const groupId = optionalUuid(row.group_id);
    const lessonId = optionalUuid(row.lesson_id);
    if (!isUuid(id) || !subjectId) {
      throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
    }
    const version = Number(row.version);
    const difficulty = Number(row.difficulty);
    const prompt = plainText(row.prompt);
    const objectiveId = optionalUuid(row.objective_id);
    const questionType = row.question_type;
    const difficultyMode = row.difficulty_mode;
    const trickCategory = typeof row.trick_category === "string" ? row.trick_category : undefined;
    const equivalenceKey = typeof row.equivalence_key === "string" ? row.equivalence_key.trim() : "";
    const governanceStage = row.governance_stage;
    const denominationScope = isRecord(row.denomination_scope) ? row.denomination_scope : {};
    const rightsMetadata = isRecord(row.rights_metadata) ? row.rights_metadata : {};
    const qualityFlags = isRecord(row.quality_flags) ? row.quality_flags : {};
    if (
      !Number.isInteger(version) || version < 1
      || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5
      || !prompt || !objectiveId || questionType !== "single_choice"
      || !["easy", "medium", "hard", "expert", "trick"].includes(String(difficultyMode))
      || !equivalenceKey || !["publication", "analytics_review"].includes(String(governanceStage))
      || row.governance_validated !== true
      || (difficultyMode === "trick" ? !trickCategory : trickCategory !== undefined)
      || Object.values(qualityFlags).some((value) => value === true)
      || /\b(?:protestants|muslims)\s+believe\b/i.test(prompt)
    ) {
      throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
    }
    const questionPermission = String(rightsMetadata.permissionStatus ?? rightsMetadata.permission_status ?? "");
    if (!["public_domain", "licensed", "permission_not_required_under_recorded_terms"].includes(questionPermission)) {
      throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
    }
    const comparative = denominationScope.comparative === true || denominationScope.comparative === "true";
    if (comparative) {
      const tradition = String(denominationScope.tradition ?? "").trim().toLowerCase();
      const sourceLocator = String(denominationScope.sourceLocator ?? denominationScope.source_locator ?? "").trim();
      const steelman = String(denominationScope.steelman ?? "").trim();
      if (!tradition || ["protestant", "protestants", "muslim", "muslims"].includes(tradition) || !sourceLocator
        || ((difficulty >= 4 || ["expert", "trick"].includes(String(difficultyMode))) && !steelman)) {
        throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
      }
    }
    const sources = parseRecordArray(row.sources).map((source): EngineSource => {
      const authorityCategory = String(source.authority_category ?? "");
      const locator = String(source.locator ?? "").trim();
      const citation = String(source.citation ?? "").trim();
      const permissionStatus = String(source.permission_status ?? "");
      if (!authorityCategory || authorityCategory === "unverified" || !locator || !citation
        || !["public_domain", "licensed", "permission_not_required_under_recorded_terms"].includes(permissionStatus)) {
        throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
      }
      return { authorityCategory, locator, citation, permissionStatus };
    });
    if (!sources.length) {
      throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
    }

    const rawOptions = parseOptions(row.options);
    const correctOptions = rawOptions.filter((option) => option.is_correct === true);
    if (correctOptions.length !== 1 || !isUuid(correctOptions[0].option_id)) {
      throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
    }
    const options = rawOptions.map((option): EngineOption => {
      if (!isUuid(option.option_id)) {
        throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
      }
      const label = plainText(option.content) || plainText(option.label);
      if (!label) {
        throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
      }
      return { id: option.option_id, label };
    });
    const optionExplanations = Object.fromEntries(rawOptions.flatMap((option) => {
      const explanation = plainText(option.explanation);
      return isUuid(option.option_id) && explanation ? [[option.option_id, explanation]] : [];
    }));
    const optionMisconceptionCodes = Object.fromEntries(rawOptions.flatMap((option) => {
      const code = typeof option.misconception_code === "string" ? option.misconception_code.trim() : "";
      return isUuid(option.option_id) && option.is_correct !== true && code ? [[option.option_id, code]] : [];
    }));
    const explanation = plainText(row.correct_answer_explanation);
    if (!explanation || Object.keys(optionExplanations).length !== 4 || Object.keys(optionMisconceptionCodes).length !== 3) {
      throw new LearningApiError("invalid_engine_feed", 503, "The canonical question feed is temporarily unavailable.");
    }
    const updatedAt = new Date(String(row.updated_at));
    if (Number.isFinite(updatedAt.getTime())) latestTimestamp = Math.max(latestTimestamp, updatedAt.getTime());

    return {
      id,
      version,
      topicId: groupId ?? subjectId,
      subjectId,
      ...(groupId ? { groupId } : {}),
      ...(lessonId ? { lessonId } : {}),
      objectiveId,
      difficulty,
      difficultyMode: difficultyMode as EngineQuestion["difficultyMode"],
      ...(trickCategory ? { trickCategory } : {}),
      equivalenceKey,
      questionType: "single_choice",
      prompt,
      options,
      correctOptionId: correctOptions[0].option_id,
      explanation,
      optionExplanations,
      optionMisconceptionCodes,
      denominationScope,
      rightsMetadata,
      qualityFlags,
      sources,
      governanceStage: governanceStage as EngineQuestion["governanceStage"],
      governanceValidated: true,
      tags: [String(row.stable_key ?? "").trim(), String(row.question_type ?? "").trim()].filter(Boolean),
    };
  });
  questions.sort((a, b) => a.id.localeCompare(b.id));
  const digest = createHash("sha256").update(JSON.stringify(questions)).digest("hex");
  return {
    version: `v1-${digest.slice(0, 24)}`,
    updatedAt: new Date(latestTimestamp || 0).toISOString(),
    questions,
  };
}

function configuredContentToken(value: string | undefined): value is string {
  if (!value || value.length < 32) return false;
  return !/(replace|placeholder|changeme|change-me|example|your[-_ ]|at-least-32)/i.test(value);
}

function authorized(request: NextRequest): boolean {
  const expected = process.env.CONTENT_API_TOKEN;
  const authorization = request.headers.get("authorization");
  if (!configuredContentToken(expected) || !authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice(7);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((candidate) => {
    const normalized = candidate.trim().replace(/^W\//, "");
    return normalized === "*" || normalized === etag;
  });
}

function feedHeaders(etag: string): Record<string, string> {
  return {
    ETag: etag,
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Authorization, If-None-Match",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function engineQuestionsResponse(request: NextRequest): Promise<NextResponse> {
  if (!configuredContentToken(process.env.CONTENT_API_TOKEN)) {
    throw new LearningApiError("engine_feed_unavailable", 503, "The canonical question feed is temporarily unavailable.");
  }
  if (!authorized(request)) {
    const response = NextResponse.json({
      error: { code: "unauthorized", message: "A valid content API token is required." },
    }, { status: 401 });
    response.headers.set("WWW-Authenticate", "Bearer");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const result = await learningQuery<Record<string, unknown>>(
    `SELECT * FROM content.published_live_question_feed ORDER BY question_id`,
  );
  const feed = buildEngineFeed(result.rows);
  const digest = createHash("sha256").update(JSON.stringify(feed)).digest("hex");
  const etag = `"${digest}"`;
  const headers = feedHeaders(etag);
  if (etagMatches(request.headers.get("if-none-match"), etag)) {
    return new NextResponse(null, { status: 304, headers });
  }
  return NextResponse.json(feed, { status: 200, headers });
}
