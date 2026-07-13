import test from "node:test";
import assert from "node:assert/strict";
import { getReusableStoredUserId, getSavedIdentityDecision } from "../src/lib/registrationRecovery.ts";
import { hasPermission, requirePermission } from "../src/lib/auth/roles.ts";
import { validateQuestion, hasBlockingValidationIssues } from "../src/lib/contentValidation.ts";
import { transitionStatus, canTransitionStatus, type DraftQuestion } from "../src/lib/contentWorkflow.ts";
import { getNextQuestionId, getWorkflowQuestionId, hasQuestionFormContent, requiresReviewComment } from "../src/lib/contentWorkflow.ts";
import { validateTopic } from "../src/lib/topicOperations.ts";
import { buildTopicSequenceConfig, validateTopicSequenceConfig } from "../src/lib/topicSequence.ts";
import { dangerousActions, isDangerConfirmationValid, requiresTypedConfirmation } from "../src/lib/dangerousActions.ts";
import { getConnectionLabel, getCountdownProgress, getLeaderboardMode, getLeaderboardTab, getMobileOnboardingState, getPhaseCopy, isAnswerInteractionDisabled, sanitizeRoomIdParam } from "../src/lib/mobileUx.ts";

const validQuestion = {
  id: "gen_0001",
  topicId: "genesis",
  difficulty: 3,
  question: "Who created the heavens and the earth?",
  choices: { A: "God", B: "Moses", C: "Adam", D: "Noah" },
  correctId: "A",
  teaching: { title: "Creation", body: "Genesis teaches that God creates.", refs: ["Genesis 1:1"] },
  tags: ["creation"],
};

test("role permission helpers enforce dashboard boundaries", () => {
  assert.equal(hasPermission("super_admin", "dangerous:execute"), true);
  assert.equal(hasPermission("author", "content:draft:create"), true);
  assert.equal(hasPermission("author", "dangerous:execute"), false);
  assert.equal(hasPermission("reviewer", "content:review"), true);
  assert.equal(hasPermission("host", "live:control"), true);
  assert.equal(hasPermission("viewer", "live:control"), false);
  assert.throws(() => requirePermission("viewer", "rooms:manage"), /does not have permission/);
});

test("question validation catches blocking content issues", () => {
  const issues = validateQuestion(
    { ...validQuestion, correctId: "Z", teaching: { title: "", body: "", refs: [] } },
    { topicIds: ["genesis"], existingIds: ["gen_0001"] }
  );

  assert.equal(hasBlockingValidationIssues(issues), true);
  assert.ok(issues.some((issue) => issue.field === "correctId"));
  assert.ok(issues.some((issue) => issue.field === "id" && issue.severity === "warning"));
  assert.ok(issues.some((issue) => issue.field === "teaching.refs" && issue.severity === "warning"));
});

test("workflow status transitions allow review flow and reject invalid jumps", () => {
  const draft: DraftQuestion = {
    ...validQuestion,
    difficulty: 3,
    correctId: "A",
    status: "draft",
    authorId: "author-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviewComments: [],
    validationIssues: [],
    version: 1,
  };

  assert.equal(canTransitionStatus("draft", "submitted"), true);
  assert.equal(canTransitionStatus("draft", "published"), false);

  const submitted = transitionStatus(draft, "submitted", new Date("2026-01-02T00:00:00.000Z"));
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.version, 2);
  assert.equal(submitted.submittedAt, "2026-01-02T00:00:00.000Z");
  assert.throws(() => transitionStatus(draft, "published"), /Cannot move/);
});

test("authoring helpers allocate stable question IDs and detect unsaved content", () => {
  assert.equal(getNextQuestionId(["gen_0001", "gen_0003", "wf_internal"], "Gen!"), "gen_0004");
  assert.equal(getNextQuestionId([], ""), "que_0001");
  assert.equal(getWorkflowQuestionId({ id: "wf_internal", questionId: "gen_0012" }), "gen_0012");
  assert.equal(getWorkflowQuestionId({ id: "legacy_0002" }), "legacy_0002");
  assert.equal(hasQuestionFormContent({ question: "", choices: { A: "", B: "", C: "", D: "" }, tags: [] }), false);
  assert.equal(hasQuestionFormContent({ teaching: { title: "Trinity", body: "", refs: [] } }), true);
  assert.equal(requiresReviewComment("changes_requested"), true);
  assert.equal(requiresReviewComment("rejected"), true);
  assert.equal(requiresReviewComment("approved"), false);
});

test("topic and sequence utilities validate operational input", () => {
  assert.deepEqual(validateTopic({
    id: "genesis",
    title: "Genesis",
    questionCount: 1,
    existingIds: ["gen_0001"],
    tags: ["creation"],
    difficultyRange: [1, 5],
  }), []);

  const config = buildTopicSequenceConfig({
    topicSequence: ["genesis", "missing"],
    countdownSeconds: 999,
    congratsDisplayTimeMs: 10,
  });
  const issues = validateTopicSequenceConfig(config, ["genesis"]);

  assert.equal(config.countdownSeconds, 120);
  assert.ok(issues.some((issue) => issue.message.includes("Unknown topic")));
});

test("dangerous actions require typed confirmation when configured", () => {
  const clearGitHub = dangerousActions.clearGitHubContent();
  const closeRoom = dangerousActions.closeRoom("Main room");

  assert.equal(requiresTypedConfirmation(clearGitHub), true);
  assert.equal(isDangerConfirmationValid(clearGitHub, "DELETE QUESTIONS"), true);
  assert.equal(isDangerConfirmationValid(clearGitHub, "delete questions"), false);
  assert.equal(requiresTypedConfirmation(closeRoom), false);
  assert.equal(isDangerConfirmationValid(closeRoom, ""), true);
});

test("Phase 4 mobile UX helpers classify onboarding, rooms, phases, and answer locks", () => {
  assert.equal(sanitizeRoomIdParam(" youth-room_1 "), "youth-room_1");
  assert.equal(sanitizeRoomIdParam("../admin"), null);
  assert.equal(getConnectionLabel("polling"), "Polling");
  assert.equal(getMobileOnboardingState({
    engineConfigured: true,
    roomId: null,
    playerName: null,
    isRegistered: false,
    phase: "LOCKED",
  }), "no_room_selected");
  assert.equal(getMobileOnboardingState({
    engineConfigured: true,
    roomId: "main",
    playerName: "Maria",
    isRegistered: true,
    phase: "LOCKED",
  }), "registered_waiting");
  assert.equal(getPhaseCopy({
    phase: "OPEN",
    hasTopicCountdown: false,
    hasTopicComplete: false,
    hasCongrats: false,
    connectionStatus: "connected",
  }).title, "Answer now");
  assert.equal(isAnswerInteractionDisabled("OPEN", "a", "submitted"), true);
  assert.equal(isAnswerInteractionDisabled("OPEN", undefined, "idle"), false);
  assert.equal(getLeaderboardTab("room-daily"), "daily");
  assert.equal(getLeaderboardTab("room-weekly"), "weekly");
  assert.equal(getLeaderboardMode("streaks"), null);
  assert.equal(getLeaderboardMode("global"), "global-all-time");
  assert.equal(getCountdownProgress(15, 30), 50);
  assert.equal(getCountdownProgress(45, 30), 100);
  assert.equal(getCountdownProgress(-5, 30), 0);
  assert.equal(getCountdownProgress(5, 0), 0);
});

test("saved quiz identities survive room switches and transient verification failures", () => {
  assert.equal(getSavedIdentityDecision({ ok: true, status: 200 }), "resume");
  assert.equal(getSavedIdentityDecision({ ok: false, status: 404, reason: "not_registered" }), "clear_identity");
  assert.equal(getSavedIdentityDecision({ ok: false, status: 404 }), "choose_room");
  assert.equal(getSavedIdentityDecision({ ok: false, status: 409 }), "choose_room");
  assert.equal(getSavedIdentityDecision({ ok: false, status: 503 }), "retry");
  assert.equal(getReusableStoredUserId("player-1", "Thabo", "thabo"), "player-1");
  assert.equal(getReusableStoredUserId("player-1", "Thabo", "AnotherPlayer"), undefined);
});
