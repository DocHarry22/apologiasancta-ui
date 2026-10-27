export const reportReasons = {
  incorrect_answer: "Incorrect answer",
  broken_citation: "Broken citation",
  unclear_wording: "Unclear wording",
  unfair_representation: "Unfair representation",
  other: "Other content issue",
} as const;

export type ReportReason = keyof typeof reportReasons;
export type ReportStatus = "open" | "in_review" | "resolved" | "dismissed";
export type ReportTarget = {
  app: "quiz" | "learn" | "research" | "graph";
  contentType: "question" | "lesson" | "claim";
  contentId: string;
  revisionId?: string;
  title: string;
  snapshot: unknown;
};

export type ContentReport = {
  id: string;
  target: ReportTarget & { revisionId: string; contentHash: string };
  reason: ReportReason;
  details: string;
  sourceUrl: string;
  reporterId: string;
  status: ReportStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  history: Array<{ actorId: string; status: ReportStatus; note: string; correctedRevisionId?: string; createdAt: string }>;
};

/** Read the revision delivered with the content, never fetch the latest version. */
export function displayedRevision(snapshot: unknown): string | undefined {
  if (!snapshot || typeof snapshot !== "object") return undefined;
  const value = snapshot as Record<string, unknown>;
  for (const key of ["reportRevisionId", "publishedRevisionId", "revisionId"]) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  if (Number.isSafeInteger(value.version) && Number(value.version) > 0) return `version:${value.version}`;
  return undefined;
}
