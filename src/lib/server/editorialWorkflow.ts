import { createHash } from "node:crypto";
import {
  editorialSourceKinds,
  type EditorialSourceKind,
  type EditorialSourceReference,
  type Question,
} from "@/types/content";
import {
  REVIEW_ATTESTATION_STATEMENT,
  type WorkflowReviewerAttestation,
} from "@/lib/editorialPolicy";

export { REVIEW_ATTESTATION_STATEMENT } from "@/lib/editorialPolicy";
export type { WorkflowReviewerAttestation, WorkflowRevisionSnapshot } from "@/lib/editorialPolicy";

export const primaryEditorialSourceKinds: readonly EditorialSourceKind[] = [
  "scripture",
  "catechism",
  "church_document",
  "council",
  "church_father",
  "canon_law",
];

export interface EditorialValidationIssue {
  field: string;
  message: string;
}

export function getEditorialPublishLeaseSeconds(environment: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(environment.EDITORIAL_PUBLISH_LEASE_SECONDS || 90);
  return Number.isFinite(configured) ? Math.min(300, Math.max(30, Math.floor(configured))) : 90;
}

export function getEditorialEngineTimeoutMs(environment: NodeJS.ProcessEnv = process.env): number {
  const leaseBudgetMs = getEditorialPublishLeaseSeconds(environment) * 1000;
  const maximumMs = Math.max(1_000, leaseBudgetMs - 5_000);
  const configured = Number(environment.EDITORIAL_ENGINE_TIMEOUT_MS || 20_000);
  if (!Number.isFinite(configured)) return Math.min(20_000, maximumMs);
  return Math.min(maximumMs, Math.max(1_000, Math.floor(configured)));
}

const MAX_SOURCES = 20;
const MAX_CITATION_LENGTH = 300;
const MAX_LOCATOR_LENGTH = 160;
const MAX_URL_LENGTH = 600;

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "string" ? value.trim() : undefined;
}

export function normalizeEditorialSources(value: unknown): EditorialSourceReference[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("sourceReferences must be an array.");
  if (value.length > MAX_SOURCES) throw new Error(`No more than ${MAX_SOURCES} source references are allowed.`);

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Source reference ${index + 1} must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.kind !== "string" || !editorialSourceKinds.includes(record.kind as EditorialSourceKind)) {
      throw new Error(`Source reference ${index + 1} has an unsupported kind.`);
    }
    if (typeof record.citation !== "string") {
      throw new Error(`Source reference ${index + 1} requires a citation.`);
    }
    const citation = record.citation.trim();
    const locator = normalizeOptionalString(record.locator);
    const url = normalizeOptionalString(record.url);
    return {
      kind: record.kind as EditorialSourceKind,
      citation,
      ...(locator ? { locator } : {}),
      ...(url ? { url } : {}),
    };
  });
}

export function validateEditorialSources(sources: readonly EditorialSourceReference[]): EditorialValidationIssue[] {
  const issues: EditorialValidationIssue[] = [];
  if (sources.length === 0) {
    issues.push({ field: "sourceReferences", message: "At least one structured source reference is required." });
    return issues;
  }

  sources.forEach((source, index) => {
    if (!editorialSourceKinds.includes(source.kind)) {
      issues.push({ field: `sourceReferences.${index}.kind`, message: "Choose a supported source type." });
    }
    if (source.citation.length < 3 || source.citation.length > MAX_CITATION_LENGTH) {
      issues.push({ field: `sourceReferences.${index}.citation`, message: `Citation must be 3-${MAX_CITATION_LENGTH} characters.` });
    }
    if (source.locator && source.locator.length > MAX_LOCATOR_LENGTH) {
      issues.push({ field: `sourceReferences.${index}.locator`, message: `Locator must be at most ${MAX_LOCATOR_LENGTH} characters.` });
    }
    if (source.url) {
      if (source.url.length > MAX_URL_LENGTH) {
        issues.push({ field: `sourceReferences.${index}.url`, message: `Source URL must be at most ${MAX_URL_LENGTH} characters.` });
      } else {
        try {
          const parsed = new URL(source.url);
          if (parsed.protocol !== "https:") throw new Error("not https");
        } catch {
          issues.push({ field: `sourceReferences.${index}.url`, message: "Source URL must be a valid HTTPS URL." });
        }
      }
    }
  });

  if (!sources.some((source) => primaryEditorialSourceKinds.includes(source.kind))) {
    issues.push({
      field: "sourceReferences",
      message: "At least one primary Catholic source is required (Scripture, Catechism, Church document, council, Father, or canon law).",
    });
  }
  return issues;
}

export function normalizeReviewerAttestation(value: unknown): WorkflowReviewerAttestation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Reviewer attestation is required for approval.");
  }
  const record = value as Record<string, unknown>;
  const requiredFlags = [
    "doctrinalFidelityConfirmed",
    "sourcesChecked",
    "explanationSupported",
    "charitableLanguageConfirmed",
    "independentReviewConfirmed",
  ] as const;
  if (requiredFlags.some((flag) => record[flag] !== true)) {
    throw new Error("Every reviewer attestation check must be explicitly confirmed.");
  }
  if (record.statement !== REVIEW_ATTESTATION_STATEMENT) {
    throw new Error("Reviewer attestation statement is missing or does not match the required statement.");
  }
  return {
    doctrinalFidelityConfirmed: true,
    sourcesChecked: true,
    explanationSupported: true,
    charitableLanguageConfirmed: true,
    independentReviewConfirmed: true,
    statement: REVIEW_ATTESTATION_STATEMENT,
  };
}

function canonicalQuestion(question: Question, sources: readonly EditorialSourceReference[]): Record<string, unknown> {
  return {
    id: question.id.trim(),
    topicId: question.topicId.trim(),
    difficulty: question.difficulty,
    question: question.question.trim(),
    choices: {
      A: question.choices.A.trim(),
      B: question.choices.B.trim(),
      C: question.choices.C.trim(),
      D: question.choices.D.trim(),
    },
    correctId: question.correctId,
    teaching: {
      title: question.teaching.title.trim(),
      body: question.teaching.body.trim(),
      refs: sources.map((source) => source.citation),
    },
    tags: [...question.tags].map((tag) => tag.trim()).filter(Boolean).sort(),
    sourceReferences: sources.map((source) => ({
      kind: source.kind,
      citation: source.citation.trim(),
      locator: source.locator?.trim() || null,
      url: source.url?.trim() || null,
    })),
  };
}

export function questionForPublication(question: Question, sources: readonly EditorialSourceReference[]): Question {
  const canonical = canonicalQuestion(question, sources);
  return {
    id: canonical.id as string,
    topicId: canonical.topicId as string,
    difficulty: canonical.difficulty as Question["difficulty"],
    question: canonical.question as string,
    choices: canonical.choices as Question["choices"],
    correctId: canonical.correctId as Question["correctId"],
    teaching: canonical.teaching as Question["teaching"],
    tags: canonical.tags as string[],
  };
}

export function computeEditorialContentHash(question: Question, sources: readonly EditorialSourceReference[]): string {
  return createHash("sha256").update(JSON.stringify(canonicalQuestion(question, sources))).digest("hex");
}

export function isSha256Hash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
