/**
 * Batch Import Utilities
 * 
 * Parsing and validation helpers for batch question import.
 */

import type { Question, QuestionChoiceId } from "@/types/content";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/** Parsed input result */
export type ParseResult =
  | { ok: true; questions: unknown[]; topicId?: string }
  | { ok: false; error: string };

/** Single question validation result */
export interface QuestionValidation {
  valid: boolean;
  errors: string[];
}

/** Batch validation result */
export interface BatchValidation {
  valid: Question[];
  invalid: Array<{ index: number; id?: string; errors: string[] }>;
}

// --------------------------------------------------------------------------
// Parsing
// --------------------------------------------------------------------------

/**
 * Parse input text into questions array.
 * 
 * Supports two formats:
 * A) [ {question}, {question}, ... ]
 * B) { "topicId"?: "...", "questions": [ ... ] }
 * 
 * @sanityCheck parseInput('[]') → { ok: true, questions: [] }
 * @sanityCheck parseInput('[{"id":"q1"}]') → { ok: true, questions: [{id:"q1"}] }
 * @sanityCheck parseInput('{"questions":[{"id":"q1"}]}') → { ok: true, questions: [{id:"q1"}] }
 * @sanityCheck parseInput('invalid') → { ok: false, error: "..." }
 */
export function parseInput(text: string): ParseResult {
  const trimmed = text.trim();
  
  if (!trimmed) {
    return { ok: false, error: "Input is empty" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : "Invalid JSON";
    return { ok: false, error: `JSON parse error: ${msg}` };
  }

  // Format A: Direct array
  if (Array.isArray(parsed)) {
    return { ok: true, questions: parsed };
  }

  // Format B: Object with questions array
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    
    if ("questions" in obj && Array.isArray(obj.questions)) {
      return {
        ok: true,
        questions: obj.questions,
        topicId: typeof obj.topicId === "string" ? obj.topicId : undefined,
      };
    }

    // Single question object (wrap in array)
    if ("id" in obj || "question" in obj) {
      return { ok: true, questions: [parsed] };
    }

    return { ok: false, error: "Object must have a 'questions' array property, or be a single question with 'id'/'question' fields" };
  }

  return { ok: false, error: "Input must be a JSON array or object with 'questions' array" };
}

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

const CHOICE_IDS: QuestionChoiceId[] = ["A", "B", "C", "D"];

/**
 * Validate a single question object.
 * 
 * Rules:
 * - id: non-empty string (required)
 * - topicId: non-empty string (can be applied later if missing)
 * - difficulty: 1-5 number OR "easy"/"medium"/"hard" string
 * - question: non-empty string
 * - choices.A/B/C/D: all non-empty strings
 * - correctId: one of "A", "B", "C", "D"
 * - teaching.title: non-empty string
 * - teaching.body: non-empty string
 * - teaching.refs: array (any length ok)
 * - tags: array if present
 * 
 * @param q The question to validate
 * @param topicIdFallback Optional topicId to apply if missing
 */
export function validateQuestion(q: unknown, topicIdFallback?: string): QuestionValidation {
  const errors: string[] = [];

  if (!q || typeof q !== "object" || Array.isArray(q)) {
    return { valid: false, errors: ["Must be an object"] };
  }

  const obj = q as Record<string, unknown>;

  // ID
  if (typeof obj.id !== "string" || !obj.id.trim()) {
    errors.push("id: required non-empty string");
  }

  // Topic ID
  const hasTopicId = typeof obj.topicId === "string" && obj.topicId.trim();
  if (!hasTopicId && !topicIdFallback) {
    errors.push("topicId: required (or select fallback topic)");
  }

  // Difficulty (optional but must be valid if present)
  if (obj.difficulty !== undefined) {
    const d = obj.difficulty;
    const validNumeric = typeof d === "number" && d >= 1 && d <= 5;
    const validString = typeof d === "string" && ["easy", "medium", "hard"].includes(d);
    if (!validNumeric && !validString) {
      errors.push("difficulty: must be 1-5 or 'easy'/'medium'/'hard'");
    }
  }

  // Question text
  if (typeof obj.question !== "string" || !obj.question.trim()) {
    errors.push("question: required non-empty string");
  }

  // Choices
  if (!obj.choices || typeof obj.choices !== "object" || Array.isArray(obj.choices)) {
    errors.push("choices: required object with A, B, C, D keys");
  } else {
    const choices = obj.choices as Record<string, unknown>;
    for (const key of CHOICE_IDS) {
      if (typeof choices[key] !== "string" || !(choices[key] as string).trim()) {
        errors.push(`choices.${key}: required non-empty string`);
      }
    }
  }

  // Correct ID
  if (!CHOICE_IDS.includes(obj.correctId as QuestionChoiceId)) {
    errors.push('correctId: must be "A", "B", "C", or "D"');
  }

  // Teaching
  if (!obj.teaching || typeof obj.teaching !== "object" || Array.isArray(obj.teaching)) {
    errors.push("teaching: required object with title, body, refs");
  } else {
    const t = obj.teaching as Record<string, unknown>;
    if (typeof t.title !== "string" || !t.title.trim()) {
      errors.push("teaching.title: required non-empty string");
    }
    if (typeof t.body !== "string" || !t.body.trim()) {
      errors.push("teaching.body: required non-empty string");
    }
    if (t.refs !== undefined && !Array.isArray(t.refs)) {
      errors.push("teaching.refs: must be an array");
    }
  }

  // Tags (optional but must be array if present)
  if (obj.tags !== undefined && !Array.isArray(obj.tags)) {
    errors.push("tags: must be an array");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a batch of questions.
 * 
 * @param questions Array of question objects to validate
 * @param topicIdFallback Optional topicId to apply if missing
 */
export function validateBatch(questions: unknown[], topicIdFallback?: string): BatchValidation {
  const valid: Question[] = [];
  const invalid: Array<{ index: number; id?: string; errors: string[] }> = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const result = validateQuestion(q, topicIdFallback);
    const id = (q as Record<string, unknown>)?.id as string | undefined;

    if (result.valid) {
      // Apply fallback topicId if needed
      const question = q as Question;
      if (!question.topicId && topicIdFallback) {
        question.topicId = topicIdFallback;
      }
      valid.push(question);
    } else {
      invalid.push({ index: i, id, errors: result.errors });
    }
  }

  return { valid, invalid };
}

/**
 * Normalize question data:
 * - Trim all string fields
 * - Convert comma-separated refs/tags strings to arrays
 * 
 * @param questions Array of question-like objects to normalize
 */
export function normalizeQuestions(questions: unknown[]): unknown[] {
  return questions.map((q) => {
    if (!q || typeof q !== "object" || Array.isArray(q)) return q;
    
    const obj = { ...(q as Record<string, unknown>) };

    // Trim string fields
    if (typeof obj.id === "string") obj.id = obj.id.trim();
    if (typeof obj.topicId === "string") obj.topicId = obj.topicId.trim();
    if (typeof obj.question === "string") obj.question = obj.question.trim();

    // Normalize choices
    if (obj.choices && typeof obj.choices === "object") {
      const choices = { ...(obj.choices as Record<string, unknown>) };
      for (const key of CHOICE_IDS) {
        if (typeof choices[key] === "string") {
          choices[key] = (choices[key] as string).trim();
        }
      }
      obj.choices = choices;
    }

    // Normalize teaching
    if (obj.teaching && typeof obj.teaching === "object") {
      const teaching = { ...(obj.teaching as Record<string, unknown>) };
      if (typeof teaching.title === "string") teaching.title = teaching.title.trim();
      if (typeof teaching.body === "string") teaching.body = teaching.body.trim();
      
      // Convert comma-separated refs string to array
      if (typeof teaching.refs === "string") {
        teaching.refs = (teaching.refs as string)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      obj.teaching = teaching;
    }

    // Convert comma-separated tags string to array
    if (typeof obj.tags === "string") {
      obj.tags = (obj.tags as string)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return obj;
  });
}

// --------------------------------------------------------------------------
// Example JSON
// --------------------------------------------------------------------------

export const EXAMPLE_JSON = `[
  {
    "id": "chr_0001",
    "topicId": "christology",
    "difficulty": 3,
    "question": "What does the term 'Logos' mean in John 1:1?",
    "choices": {
      "A": "Spirit",
      "B": "Word",
      "C": "Light",
      "D": "Father"
    },
    "correctId": "B",
    "teaching": {
      "title": "The Divine Logos",
      "body": "In John 1:1, 'Logos' refers to the eternal Word...",
      "refs": ["John 1:1", "CCC 241"]
    },
    "tags": ["johannine", "trinity"]
  }
]`;

export const EXAMPLE_JSON_WRAPPED = `{
  "topicId": "christology",
  "questions": [
    { ... }
  ]
}`;
