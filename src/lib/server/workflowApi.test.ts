import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "./currentUser";
import type { WorkflowItem } from "./storage/types";

const apiMocks = vi.hoisted(() => ({
  user: null as CurrentUser | null,
  item: null as WorkflowItem | null,
  transitionWorkflowItem: vi.fn(),
  appendAuditEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/content", () => ({
  listPublishedQuestionRecords: vi.fn(async () => []),
  listTopicsWithCounts: vi.fn(async () => [{ id: "trinity" }]),
}));

vi.mock("./apiAuth", async () => {
  const actual = await vi.importActual<typeof import("./apiAuth")>("./apiAuth");
  return {
    ...actual,
    requireAuthorSession: vi.fn(async () => ({ ok: true, user: apiMocks.user })),
    requireCsrf: vi.fn(async () => null),
  };
});

vi.mock("./storage/auditStore", () => ({
  appendAuditEvent: apiMocks.appendAuditEvent,
}));

vi.mock("./engineProxy", () => ({
  publishQuestionToEngine: vi.fn(),
}));

vi.mock("./storage/workflowStore", () => {
  class WorkflowConflictError extends Error {}
  class WorkflowValidationError extends Error {}
  class WorkflowPublicationError extends Error {}
  return {
    WorkflowConflictError,
    WorkflowValidationError,
    WorkflowPublicationError,
    getWorkflowItem: vi.fn(async () => apiMocks.item),
    listWorkflowItems: vi.fn(async () => []),
    createWorkflowDraft: vi.fn(),
    updateWorkflowDraft: vi.fn(),
    transitionWorkflowItem: apiMocks.transitionWorkflowItem,
    prepareWorkflowPublication: vi.fn(),
    completeWorkflowPublication: vi.fn(),
    failWorkflowPublication: vi.fn(),
  };
});

import { transitionWorkflowRoute } from "./workflowApi";

const originalAuthor: CurrentUser = {
  id: "original-author",
  displayName: "Original Author",
  role: "author",
  accountType: "staff",
  source: "database",
};

const adminRevisionCreator: CurrentUser = {
  id: "admin-editor",
  displayName: "Admin Editor",
  role: "super_admin",
  accountType: "staff",
  source: "database",
};

const independentReviewer: CurrentUser = {
  id: "independent-reviewer",
  displayName: "Independent Reviewer",
  role: "reviewer",
  accountType: "staff",
  source: "database",
};

function submittedAdminRevision(): WorkflowItem {
  const timestamp = "2026-07-16T20:00:00.000Z";
  const contentHash = "a".repeat(64);
  return {
    id: "wf_api_independence",
    questionId: "edt_api_independence",
    topicId: "trinity",
    difficulty: 2,
    question: "Who may review an administrator-authored immutable revision?",
    choices: { A: "A different reviewer", B: "The same administrator", C: "Nobody", D: "Any anonymous user" },
    correctId: "A",
    teaching: {
      title: "Independent review follows the revision author",
      body: "A different human reviewer must check the exact immutable revision against its cited primary source.",
      refs: ["Matthew 28:19"],
    },
    tags: ["editorial-test"],
    sourceReferences: [{ kind: "scripture", citation: "Matthew 28:19" }],
    status: "submitted",
    authorId: originalAuthor.id,
    authorName: originalAuthor.displayName,
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: timestamp,
    version: 4,
    revisionNumber: 2,
    currentRevisionId: "wf_rev_admin_edit",
    contentHash,
    changesRequestedRevisionId: "wf_rev_original",
    changesRequestedContentHash: "b".repeat(64),
    revisions: [{
      id: "wf_rev_admin_edit",
      revisionNumber: 2,
      contentHash,
      createdAt: timestamp,
      createdBy: adminRevisionCreator.id,
      question: {
        id: "edt_api_independence",
        topicId: "trinity",
        difficulty: 2,
        question: "Who may review an administrator-authored immutable revision?",
        choices: { A: "A different reviewer", B: "The same administrator", C: "Nobody", D: "Any anonymous user" },
        correctId: "A",
        teaching: {
          title: "Independent review follows the revision author",
          body: "A different human reviewer must check the exact immutable revision against its cited primary source.",
          refs: ["Matthew 28:19"],
        },
        tags: ["editorial-test"],
        sourceReferences: [{ kind: "scripture", citation: "Matthew 28:19" }],
      },
      sourceReferences: [{ kind: "scripture", citation: "Matthew 28:19" }],
    }],
    validationIssues: [],
    reviewComments: [],
    doctrinalFlags: [],
    referenceFlags: [],
    history: [],
  };
}

function approveRequest() {
  return new NextRequest("https://ui.test/api/workflow/items/wf_api_independence/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ comment: "The exact revision and cited primary source were independently checked." }),
  });
}

describe("workflow API revision-author independence", () => {
  beforeEach(() => {
    apiMocks.item = submittedAdminRevision();
    apiMocks.user = independentReviewer;
    apiMocks.transitionWorkflowItem.mockReset();
    apiMocks.appendAuditEvent.mockClear();
  });

  it("denies a super-admin who created the current immutable revision before transition storage is called", async () => {
    apiMocks.user = adminRevisionCreator;

    const response = await transitionWorkflowRoute(approveRequest(), apiMocks.item!.id, "approved", "workflow.approve");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Forbidden" });
    expect(apiMocks.transitionWorkflowItem).not.toHaveBeenCalled();
  });

  it("allows a different authorized reviewer to reach the exact-revision transition", async () => {
    const approved = { ...apiMocks.item!, status: "approved" as const, reviewerId: independentReviewer.id };
    apiMocks.transitionWorkflowItem.mockResolvedValue(approved);

    const response = await transitionWorkflowRoute(approveRequest(), apiMocks.item!.id, "approved", "workflow.approve");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, item: { reviewerId: independentReviewer.id } });
    expect(apiMocks.transitionWorkflowItem).toHaveBeenCalledWith(
      apiMocks.item!.id,
      "approved",
      independentReviewer,
      expect.objectContaining({ comment: expect.stringContaining("independently checked") })
    );
  });
});
