function camelKey(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

const numericKeys = new Set([
  "display_order",
  "estimated_minutes",
  "version",
  "difficulty",
  "mastery_threshold_percent",
  "mastery_weight",
  "reading_progress_percent",
  "completed_lesson_version",
  "question_count",
  "pass_threshold_percent",
  "score_percent",
  "correct_count",
  "completed_lessons",
  "total_lessons",
  "best_score_percent",
  "minimum_score_percent",
  "position",
  "weight",
  "interval_days",
  "ease_factor",
  "repetition_count",
  "attempt_count",
  "incorrect_count",
  "average_score",
  "awarded_points",
]);

/** Converts the platform's safe structured text blocks to display text. */
export function learningDisplayText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(learningDisplayText).filter(Boolean).join("\n").trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["text", "label", "prompt", "body", "content", "summary"]) {
    const text = learningDisplayText(record[key]);
    if (text) return text;
  }
  for (const key of ["children", "blocks", "paragraphs"]) {
    const text = learningDisplayText(record[key]);
    if (text) return text;
  }
  return "";
}

export function serializeLearningValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeLearningValue);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const numeric = numericKeys.has(key) && typeof child === "string" && child.trim() !== ""
        ? Number(child)
        : child;
      output[camelKey(key)] = serializeLearningValue(Number.isFinite(numeric as number) ? numeric : child);
    }
    return output;
  }
  return value;
}

export function serializeLearningRow<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  return serializeLearningValue(row) as T;
}

export function extractPageRows(rows: Record<string, unknown>[]) {
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    total,
    data: rows.map((sourceRow) => {
      const row = { ...sourceRow };
      delete row.total_count;
      return serializeLearningRow(row);
    }),
  };
}
