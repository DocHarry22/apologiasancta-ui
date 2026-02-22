/**
 * Tests for batchImportUtils
 * 
 * Run with: npx tsx src/lib/batchImportUtils.test.ts
 */

import {
  parseInput,
  validateQuestion,
  validateBatch,
  normalizeQuestions,
} from "./batchImportUtils";

// --------------------------------------------------------------------------
// Test helpers
// --------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(`  ${e instanceof Error ? e.message : e}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// --------------------------------------------------------------------------
// parseInput tests
// --------------------------------------------------------------------------

console.log("\n--- parseInput tests ---\n");

test("parseInput: empty string returns error", () => {
  const result = parseInput("");
  assert(!result.ok, "should not be ok");
  if (!result.ok) {
    assert(result.error.includes("empty"), "should mention empty");
  }
});

test("parseInput: whitespace-only returns error", () => {
  const result = parseInput("   \n\t  ");
  assert(!result.ok, "should not be ok");
});

test("parseInput: invalid JSON returns parse error", () => {
  const result = parseInput("{not valid json}");
  assert(!result.ok, "should not be ok");
  if (!result.ok) {
    assert(result.error.includes("parse"), "should mention parse error");
  }
});

test("parseInput: empty array returns ok with empty questions", () => {
  const result = parseInput("[]");
  assert(result.ok, "should be ok");
  if (result.ok) {
    assertEqual(result.questions.length, 0, "should have 0 questions");
  }
});

test("parseInput: array of questions returns ok", () => {
  const result = parseInput('[{"id":"q1"}, {"id":"q2"}]');
  assert(result.ok, "should be ok");
  if (result.ok) {
    assertEqual(result.questions.length, 2, "should have 2 questions");
  }
});

test("parseInput: object with questions array returns ok", () => {
  const result = parseInput('{"questions":[{"id":"q1"}]}');
  assert(result.ok, "should be ok");
  if (result.ok) {
    assertEqual(result.questions.length, 1, "should have 1 question");
  }
});

test("parseInput: object with topicId + questions extracts topicId", () => {
  const result = parseInput('{"topicId":"christology","questions":[{"id":"q1"}]}');
  assert(result.ok, "should be ok");
  if (result.ok) {
    assertEqual(result.topicId, "christology", "should extract topicId");
    assertEqual(result.questions.length, 1, "should have 1 question");
  }
});

test("parseInput: single question object wraps in array", () => {
  const result = parseInput('{"id":"q1","question":"What?"}');
  assert(result.ok, "should be ok");
  if (result.ok) {
    assertEqual(result.questions.length, 1, "should wrap in array");
  }
});

test("parseInput: object without questions or id returns error", () => {
  const result = parseInput('{"foo":"bar"}');
  assert(!result.ok, "should not be ok");
  if (!result.ok) {
    assert(result.error.includes("questions"), "should mention questions");
  }
});

// --------------------------------------------------------------------------
// validateQuestion tests
// --------------------------------------------------------------------------

console.log("\n--- validateQuestion tests ---\n");

const validQuestion = {
  id: "chr_0001",
  topicId: "christology",
  difficulty: 3,
  question: "What is the doctrine of the Trinity?",
  choices: {
    A: "One God in three persons",
    B: "Three separate gods",
    C: "One person with three modes",
    D: "A hierarchy of divine beings",
  },
  correctId: "A",
  teaching: {
    title: "The Holy Trinity",
    body: "The doctrine of the Trinity states that God is one being in three persons.",
    refs: ["CCC 234", "John 1:1"],
  },
  tags: ["trinity", "dogma"],
};

test("validateQuestion: valid question passes", () => {
  const result = validateQuestion(validQuestion);
  assert(result.valid, `should be valid: ${result.errors.join(", ")}`);
});

test("validateQuestion: missing id fails", () => {
  const q = { ...validQuestion, id: "" };
  const result = validateQuestion(q);
  assert(!result.valid, "should not be valid");
  assert(result.errors.some((e) => e.includes("id")), "should mention id");
});

test("validateQuestion: missing topicId fails (without fallback)", () => {
  const q = { ...validQuestion, topicId: "" };
  const result = validateQuestion(q);
  assert(!result.valid, "should not be valid");
  assert(result.errors.some((e) => e.includes("topicId")), "should mention topicId");
});

test("validateQuestion: missing topicId passes with fallback", () => {
  const q = { ...validQuestion, topicId: "" };
  const result = validateQuestion(q, "christology");
  assert(result.valid, "should be valid with fallback");
});

test("validateQuestion: missing question text fails", () => {
  const q = { ...validQuestion, question: "" };
  const result = validateQuestion(q);
  assert(!result.valid, "should not be valid");
});

test("validateQuestion: missing choice A fails", () => {
  const q = { ...validQuestion, choices: { ...validQuestion.choices, A: "" } };
  const result = validateQuestion(q);
  assert(!result.valid, "should not be valid");
  assert(result.errors.some((e) => e.includes("choices.A")), "should mention choices.A");
});

test("validateQuestion: invalid correctId fails", () => {
  const q = { ...validQuestion, correctId: "E" };
  const result = validateQuestion(q);
  assert(!result.valid, "should not be valid");
  assert(result.errors.some((e) => e.includes("correctId")), "should mention correctId");
});

test("validateQuestion: missing teaching.title fails", () => {
  const q = { ...validQuestion, teaching: { ...validQuestion.teaching, title: "" } };
  const result = validateQuestion(q);
  assert(!result.valid, "should not be valid");
});

test("validateQuestion: missing teaching.body fails", () => {
  const q = { ...validQuestion, teaching: { ...validQuestion.teaching, body: "" } };
  const result = validateQuestion(q);
  assert(!result.valid, "should not be valid");
});

test("validateQuestion: difficulty as string 'easy'/'medium'/'hard' passes", () => {
  const q = { ...validQuestion, difficulty: "medium" };
  const result = validateQuestion(q);
  assert(result.valid, `should be valid: ${result.errors.join(", ")}`);
});

test("validateQuestion: invalid difficulty fails", () => {
  const q = { ...validQuestion, difficulty: 10 };
  const result = validateQuestion(q);
  assert(!result.valid, "should not be valid");
});

test("validateQuestion: tags as non-array fails", () => {
  const q = { ...validQuestion, tags: "not-an-array" };
  const result = validateQuestion(q);
  assert(!result.valid, "should not be valid");
});

// --------------------------------------------------------------------------
// validateBatch tests
// --------------------------------------------------------------------------

console.log("\n--- validateBatch tests ---\n");

test("validateBatch: all valid questions pass", () => {
  const result = validateBatch([validQuestion, { ...validQuestion, id: "chr_0002" }]);
  assertEqual(result.valid.length, 2, "should have 2 valid");
  assertEqual(result.invalid.length, 0, "should have 0 invalid");
});

test("validateBatch: mixed valid/invalid separates correctly", () => {
  const badQuestion = { ...validQuestion, id: "", question: "" };
  const result = validateBatch([validQuestion, badQuestion]);
  assertEqual(result.valid.length, 1, "should have 1 valid");
  assertEqual(result.invalid.length, 1, "should have 1 invalid");
  assertEqual(result.invalid[0].index, 1, "invalid should be at index 1");
});

test("validateBatch: applies fallback topicId", () => {
  const noTopicQ = { ...validQuestion, topicId: "" };
  const result = validateBatch([noTopicQ], "mariology");
  assertEqual(result.valid.length, 1, "should have 1 valid");
  assertEqual(result.valid[0].topicId, "mariology", "should apply fallback topicId");
});

// --------------------------------------------------------------------------
// normalizeQuestions tests
// --------------------------------------------------------------------------

console.log("\n--- normalizeQuestions tests ---\n");

test("normalizeQuestions: trims string fields", () => {
  const q = {
    id: "  chr_0001  ",
    topicId: " christology ",
    question: "  What?  ",
    choices: { A: " A ", B: " B ", C: " C ", D: " D " },
    teaching: { title: " Title ", body: " Body " },
  };
  const result = normalizeQuestions([q]) as typeof q[];
  assertEqual(result[0].id, "chr_0001", "id should be trimmed");
  assertEqual(result[0].question, "What?", "question should be trimmed");
});

test("normalizeQuestions: converts comma-separated refs to array", () => {
  const q = {
    id: "chr_0001",
    teaching: { title: "T", body: "B", refs: "CCC 234, John 1:1, Matt 5:3" },
  };
  const result = normalizeQuestions([q]) as Array<{ teaching: { refs: string[] } }>;
  assert(Array.isArray(result[0].teaching.refs), "refs should be array");
  assertEqual(result[0].teaching.refs.length, 3, "should have 3 refs");
  assertEqual(result[0].teaching.refs[0], "CCC 234", "first ref correct");
});

test("normalizeQuestions: converts comma-separated tags to array", () => {
  const q = {
    id: "chr_0001",
    tags: "trinity, dogma, council",
  };
  const result = normalizeQuestions([q]) as Array<{ tags: string[] }>;
  assert(Array.isArray(result[0].tags), "tags should be array");
  assertEqual(result[0].tags.length, 3, "should have 3 tags");
});

// --------------------------------------------------------------------------
// Summary
// --------------------------------------------------------------------------

console.log("\n--- Summary ---\n");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
