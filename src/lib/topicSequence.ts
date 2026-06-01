export type LoopMode = "off" | "once" | "infinite" | number;

export interface TopicSequenceConfig {
  topicSequence: string[];
  congratsDisplayTimeMs: number;
  countdownSeconds: number;
  autoAdvance: boolean;
  topicLoopMode: LoopMode;
  topicRepeatsRemaining: number;
  seriesLoopMode: LoopMode;
  seriesRepeatsRemaining: number;
}

export type SequenceValidationIssue = {
  field: string;
  message: string;
};

export function buildTopicSequenceConfig(input: Partial<TopicSequenceConfig>): TopicSequenceConfig {
  return {
    topicSequence: input.topicSequence ?? [],
    autoAdvance: input.autoAdvance ?? true,
    countdownSeconds: clampNumber(input.countdownSeconds, 1, 120, 10),
    congratsDisplayTimeMs: clampNumber(input.congratsDisplayTimeMs, 500, 30000, 5000),
    topicLoopMode: normalizeLoopMode(input.topicLoopMode),
    topicRepeatsRemaining: Math.max(0, Number(input.topicRepeatsRemaining ?? 0)),
    seriesLoopMode: normalizeLoopMode(input.seriesLoopMode),
    seriesRepeatsRemaining: Math.max(0, Number(input.seriesRepeatsRemaining ?? 0)),
  };
}

export function validateTopicSequenceConfig(
  config: TopicSequenceConfig,
  availableTopicIds: readonly string[]
): SequenceValidationIssue[] {
  const issues: SequenceValidationIssue[] = [];

  if (config.topicSequence.length === 0) {
    issues.push({ field: "topicSequence", message: "Select at least one topic for the live sequence." });
  }

  for (const topicId of config.topicSequence) {
    if (!availableTopicIds.includes(topicId)) {
      issues.push({ field: "topicSequence", message: `Unknown topic in sequence: ${topicId}` });
    }
  }

  if (config.countdownSeconds < 1 || config.countdownSeconds > 120) {
    issues.push({ field: "countdownSeconds", message: "Countdown must be between 1 and 120 seconds." });
  }

  if (config.congratsDisplayTimeMs < 500 || config.congratsDisplayTimeMs > 30000) {
    issues.push({ field: "congratsDisplayTimeMs", message: "Congrats display time must be between 500 and 30000 ms." });
  }

  return issues;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeLoopMode(value: unknown): LoopMode {
  if (value === "off" || value === "once" || value === "infinite") return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : "off";
}
