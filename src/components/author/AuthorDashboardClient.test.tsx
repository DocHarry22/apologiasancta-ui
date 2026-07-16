// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DraftQuestion } from "@/lib/contentWorkflow";
import type { CurrentUser } from "@/lib/server/currentUser";
import { canCreateWorkflow, canEditWorkflowItem, canSubmitWorkflowItem } from "@/lib/workflowPermissions";
import AuthorDashboardClient from "./AuthorDashboardClient";

const operationalMocks = vi.hoisted(() => ({
  adminStatus: vi.fn(async () => ({
    success: true,
    data: {
      running: true,
      phase: "lobby",
      questionIndex: 0,
      totalQuestions: 0,
      connectedClients: 0,
      playerCount: 0,
      persistence: { configured: true },
    },
  })),
  contentStatus: vi.fn(async () => ({ success: true, data: { bankSize: 12 } })),
  roomList: vi.fn(async () => ({ success: true, data: { rooms: [] } })),
  sequence: vi.fn(async () => ({ success: true, data: { config: { topicSequence: ["trinity"] } } })),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }),
}));

vi.mock("@/lib/publicEnv", () => ({
  getEngineUrl: () => "",
}));

vi.mock("@/lib/adminProxyClient", () => ({
  adminProxy: { status: operationalMocks.adminStatus },
  contentProxy: { status: operationalMocks.contentStatus },
  quizProxy: {},
  roomProxy: { list: operationalMocks.roomList },
  topicProxy: { getSequence: operationalMocks.sequence },
}));

const questionFields = {
  topicId: "trinity",
  difficulty: 2 as const,
  choices: { A: "One", B: "Two", C: "Three", D: "Four" },
  correctId: "A" as const,
  teaching: {
    title: "A sourced explanation",
    body: "This sufficiently detailed explanation is grounded in the cited primary source.",
    refs: ["Matthew 28:19"],
  },
  tags: ["editorial-test"],
  sourceReferences: [{ kind: "scripture" as const, citation: "Matthew 28:19", locator: "Gospel of Matthew" }],
};

function workflowItem(status: "submitted" | "approved", suffix: string): DraftQuestion {
  const timestamp = "2026-07-16T12:00:00.000Z";
  return {
    id: `wf_${suffix}`,
    questionId: `edt_${suffix}`,
    ...questionFields,
    question: status === "approved" ? "Approved item question" : "Submitted item question",
    status,
    authorId: "author-1",
    authorName: "Author One",
    reviewerId: status === "approved" ? "reviewer-1" : undefined,
    reviewerName: status === "approved" ? "Reviewer One" : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: timestamp,
    reviewedAt: status === "approved" ? timestamp : undefined,
    version: status === "approved" ? 3 : 2,
    revisionNumber: 1,
    currentRevisionId: `wf_rev_${suffix}`,
    contentHash: "a".repeat(64),
    approvedRevisionId: status === "approved" ? `wf_rev_${suffix}` : undefined,
    approvedContentHash: status === "approved" ? "a".repeat(64) : undefined,
    validationIssues: [],
    reviewComments: [],
  };
}

const approved = workflowItem("approved", "0500");
const submitted = workflowItem("submitted", "0501");

const author: CurrentUser = {
  id: "author-1",
  displayName: "Author One",
  role: "author",
  accountType: "staff",
  source: "database",
};

const superAdmin: CurrentUser = {
  id: "publisher-1",
  displayName: "Publisher One",
  role: "super_admin",
  accountType: "staff",
  source: "database",
};

const admin: CurrentUser = {
  id: "admin-1",
  displayName: "Admin One",
  role: "admin",
  accountType: "staff",
  source: "database",
};

function changesRequestedItem(): DraftQuestion {
  const timestamp = "2026-07-16T12:00:00.000Z";
  const currentRevisionId = "wf_rev_0600";
  const contentHash = "a".repeat(64);
  const question = {
    id: "edt_0600",
    ...questionFields,
    question: "Changes requested item question",
  };
  return {
    ...question,
    id: "wf_0600",
    questionId: question.id,
    status: "changes_requested",
    authorId: author.id,
    authorName: author.displayName,
    reviewerId: "reviewer-1",
    reviewerName: "Reviewer One",
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: timestamp,
    reviewedAt: timestamp,
    version: 3,
    revisionNumber: 1,
    currentRevisionId,
    contentHash,
    changesRequestedRevisionId: currentRevisionId,
    changesRequestedContentHash: contentHash,
    revisions: [{
      id: currentRevisionId,
      revisionNumber: 1,
      contentHash,
      createdAt: timestamp,
      createdBy: author.id,
      question,
      sourceReferences: questionFields.sourceReferences,
    }],
    validationIssues: [],
    reviewComments: [{
      id: "comment_0600",
      authorId: "reviewer-1",
      authorName: "Reviewer One",
      authorRole: "reviewer",
      body: "Clarify how the explanation follows from the cited primary source.",
      createdAt: timestamp,
      decision: "changes_requested",
      revisionId: currentRevisionId,
      contentHash,
      referenceFlag: true,
    }],
    doctrinalFlags: [],
    referenceFlags: ["reviewer-1"],
    history: [],
  };
}

function response(ok: boolean, status: number, body: Record<string, unknown>): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("AuthorDashboardClient editorial queue", () => {
  beforeEach(() => {
    operationalMocks.adminStatus.mockClear();
    operationalMocks.contentStatus.mockClear();
    operationalMocks.roomList.mockClear();
    operationalMocks.sequence.mockClear();
    document.cookie = "as_csrf_token=test-csrf; path=/";
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.cookie = "as_csrf_token=; Max-Age=0; path=/";
  });

  it("keeps shared workflow authoring capabilities scoped to admin and owning authors", () => {
    const ownDraft = { authorId: "author-1", status: "draft" };
    const otherDraft = { authorId: "author-2", status: "draft" };
    const submittedItem = { authorId: "author-1", status: "submitted" };

    expect(canCreateWorkflow("admin")).toBe(true);
    expect(canEditWorkflowItem("admin", "admin-1", otherDraft)).toBe(true);
    expect(canSubmitWorkflowItem("admin", "admin-1", otherDraft)).toBe(true);
    expect(canCreateWorkflow("author")).toBe(true);
    expect(canEditWorkflowItem("author", "author-1", ownDraft)).toBe(true);
    expect(canSubmitWorkflowItem("author", "author-1", ownDraft)).toBe(true);
    expect(canEditWorkflowItem("author", "author-1", submittedItem)).toBe(false);
    expect(canEditWorkflowItem("author", "author-1", otherDraft)).toBe(false);
    for (const role of ["reviewer", "host", "viewer"] as const) {
      expect(canCreateWorkflow(role)).toBe(false);
      expect(canEditWorkflowItem(role, `${role}-1`, otherDraft)).toBe(false);
      expect(canSubmitWorkflowItem(role, `${role}-1`, otherDraft)).toBe(false);
    }
  });

  it("keeps approved revisions selectable and retryable after reload without changing submitted review controls", async () => {
    const user = userEvent.setup();
    let publishAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/workflow/items" && method === "GET") {
        return response(true, 200, { ok: true, items: [approved, submitted] });
      }
      if (url === `/api/workflow/items/${approved.id}/publish` && method === "POST") {
        publishAttempts += 1;
        if (publishAttempts === 1) {
          return response(false, 502, { ok: false, error: "Engine temporarily unavailable." });
        }
        return response(true, 200, {
          ok: true,
          item: { ...approved, status: "published", publishTarget: "engine" },
          publishTarget: "engine",
          publishResult: { added: 1, updated: 0, bankSize: 13 },
        });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(
      <AuthorDashboardClient
        topics={[{
          id: "trinity",
          title: "The Trinity",
          description: "Catholic doctrine of the Trinity",
          tags: ["doctrine"],
          questionCount: 2,
          existingIds: [],
        }]}
        publishedQuestions={[]}
        currentUser={superAdmin}
        initialTab="review"
      />
    );

    expect(await screen.findByRole("heading", { name: "Approved for publication" })).toBeInTheDocument();
    expect(await screen.findByText("Approved item question")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Awaiting theological review" })).toBeInTheDocument();
    expect(await screen.findByText("Submitted item question")).toBeInTheDocument();

    const submittedCard = screen.getByText("Submitted item question").closest(".rounded-lg");
    expect(submittedCard).not.toBeNull();
    await user.click(within(submittedCard as HTMLElement).getByRole("button", { name: "Open" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve attested revision" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish or retry" })).not.toBeInTheDocument();

    const approvedCard = screen.getByText("Approved item question").closest(".rounded-lg");
    expect(approvedCard).not.toBeNull();
    await user.click(within(approvedCard as HTMLElement).getByRole("button", { name: "Open" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve attested revision" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish or retry" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish or retry" }));
    expect(await screen.findByText("Engine temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish or retry" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish or retry" }));
    await waitFor(() => expect(screen.queryByText("Approved item question")).not.toBeInTheDocument());
    expect(screen.getByText("Submitted item question")).toBeInTheDocument();
    expect(publishAttempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(`/api/workflow/items/${approved.id}/publish`, expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-csrf-token": "test-csrf" }),
    }));

    unmount();
  });

  it("loads requested changes, saves a changed immutable revision, and only then enables resubmission", async () => {
    const user = userEvent.setup();
    const changesRequested = changesRequestedItem();
    const changedExplanation = "The revised explanation now explicitly connects the correct answer to Matthew 28:19 and distinguishes the unsupported alternatives.";
    const revised: DraftQuestion = {
      ...changesRequested,
      teaching: { ...changesRequested.teaching, body: changedExplanation },
      updatedAt: "2026-07-16T12:05:00.000Z",
      version: 4,
      revisionNumber: 2,
      currentRevisionId: "wf_rev_0601",
      contentHash: "b".repeat(64),
      reviewerId: undefined,
      reviewerName: undefined,
      reviewedAt: undefined,
      revisions: [
        ...(changesRequested.revisions || []),
        {
          id: "wf_rev_0601",
          revisionNumber: 2,
          contentHash: "b".repeat(64),
          createdAt: "2026-07-16T12:05:00.000Z",
          createdBy: author.id,
          question: {
            id: changesRequested.questionId!,
            ...questionFields,
            question: changesRequested.question,
            teaching: { ...changesRequested.teaching, body: changedExplanation },
          },
          sourceReferences: questionFields.sourceReferences,
        },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/workflow/items" && method === "GET") {
        return response(true, 200, { ok: true, items: [changesRequested] });
      }
      if (url === `/api/workflow/items/${changesRequested.id}` && method === "PATCH") {
        return response(true, 200, { ok: true, item: revised });
      }
      if (url === `/api/workflow/items/${changesRequested.id}/submit` && method === "POST") {
        return response(true, 200, { ok: true, item: { ...revised, status: "submitted" } });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthorDashboardClient
        topics={[{
          id: "trinity",
          title: "The Trinity",
          description: "Catholic doctrine of the Trinity",
          tags: ["doctrine"],
          questionCount: 2,
          existingIds: [],
        }]}
        publishedQuestions={[]}
        currentUser={author}
        initialTab="authoring"
      />
    );

    expect(await screen.findByText("Changes requested item question")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resubmit revised question" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit requested changes" }));
    expect(screen.getByRole("heading", { name: "Edit Requested Changes" })).toBeInTheDocument();
    expect(screen.getByText(/Clarify how the explanation follows/)).toBeInTheDocument();

    const explanation = screen.getByLabelText("Teaching explanation");
    await user.clear(explanation);
    await user.type(explanation, changedExplanation);
    await user.click(screen.getByRole("button", { name: "Save new revision" }));

    expect(await screen.findByText(/ready to resubmit for independent review/i)).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find(([url, init]) => (
      String(url) === `/api/workflow/items/${changesRequested.id}` && init?.method === "PATCH"
    ));
    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      question: { teaching: { body: changedExplanation } },
    });
    expect(patchCall?.[1]?.headers).toMatchObject({ "x-csrf-token": "test-csrf" });

    const resubmitButtons = screen.getAllByRole("button", { name: "Resubmit revised question" });
    expect(resubmitButtons.length).toBeGreaterThan(0);
    await user.click(resubmitButtons[0]);
    expect(await screen.findByText("Question submitted for review.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/workflow/items/${changesRequested.id}/submit`,
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-csrf-token": "test-csrf" }) })
    );
    expect(screen.queryByRole("button", { name: "Resubmit revised question" })).not.toBeInTheDocument();
  });

  it("uses canonical workflow capabilities for an admin to create, edit, and submit without widening other roles", async () => {
    const user = userEvent.setup();
    const draft: DraftQuestion = {
      ...submitted,
      id: "wf_0700",
      questionId: "edt_0700",
      question: "Admin editable draft question",
      status: "draft",
      submittedAt: undefined,
      version: 1,
    };
    const changesRequested: DraftQuestion = {
      ...changesRequestedItem(),
      id: "wf_0701",
      questionId: "edt_0701",
      question: "Admin editable requested-change question",
    };
    const createdByAdmin: DraftQuestion = {
      ...draft,
      id: "wf_0702",
      questionId: "edt_0702",
      question: "Admin-created draft",
      authorId: admin.id,
      authorName: admin.displayName,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/workflow/items" && method === "GET") {
        return response(true, 200, { ok: true, items: [draft, changesRequested] });
      }
      if (url === `/api/workflow/items/${draft.id}/submit` && method === "POST") {
        return response(true, 200, { ok: true, item: { ...draft, status: "submitted" } });
      }
      if (url === `/api/workflow/items/${changesRequested.id}` && method === "PATCH") {
        return response(true, 200, { ok: true, item: changesRequested });
      }
      if (url === "/api/workflow/items" && method === "POST") {
        return response(true, 200, { ok: true, item: createdByAdmin });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthorDashboardClient
        topics={[{
          id: "trinity",
          title: "The Trinity",
          description: "Catholic doctrine of the Trinity",
          tags: ["doctrine"],
          questionCount: 2,
          existingIds: [],
        }]}
        publishedQuestions={[]}
        currentUser={admin}
        initialTab="authoring"
      />
    );

    expect(await screen.findByRole("heading", { name: "Create Draft Question" })).toBeInTheDocument();
    const draftCard = (await screen.findByText("Admin editable draft question")).closest(".rounded-lg");
    expect(draftCard).not.toBeNull();
    await user.click(within(draftCard as HTMLElement).getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Question submitted for review.")).toBeInTheDocument();

    const requestedChangeCard = screen.getByText("Admin editable requested-change question").closest(".rounded-lg");
    expect(requestedChangeCard).not.toBeNull();
    await user.click(within(requestedChangeCard as HTMLElement).getByRole("button", { name: "Edit requested changes" }));
    expect(screen.getByRole("heading", { name: "Edit Requested Changes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save new revision" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/workflow/items/${changesRequested.id}`,
      expect.objectContaining({ method: "PATCH" })
    ));

    await user.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(screen.getByRole("heading", { name: "Create Draft Question" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(await screen.findByText("Draft saved to workflow storage.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/workflow/items", expect.objectContaining({ method: "POST" }));
  }, 10_000);

  it("disables every review decision when the signed-in admin created the current revision", async () => {
    const adminAuthoredRevision: DraftQuestion = {
      ...submitted,
      revisions: [{
        id: submitted.currentRevisionId!,
        revisionNumber: submitted.revisionNumber!,
        contentHash: submitted.contentHash!,
        createdAt: submitted.updatedAt,
        createdBy: superAdmin.id,
        question: {
          id: submitted.questionId!,
          ...questionFields,
          question: submitted.question,
        },
        sourceReferences: questionFields.sourceReferences,
      }],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/workflow/items" && (init?.method ?? "GET") === "GET") {
        return response(true, 200, { ok: true, items: [adminAuthoredRevision] });
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${String(input)}`);
    }));
    const user = userEvent.setup();

    render(
      <AuthorDashboardClient
        topics={[{
          id: "trinity",
          title: "The Trinity",
          description: "Catholic doctrine of the Trinity",
          tags: ["doctrine"],
          questionCount: 2,
          existingIds: [],
        }]}
        publishedQuestions={[]}
        currentUser={superAdmin}
        initialTab="review"
      />
    );

    expect(await screen.findByText("Submitted item question")).toBeInTheDocument();
    const submittedCard = screen.getByText("Submitted item question").closest(".rounded-lg");
    await user.click(within(submittedCard as HTMLElement).getByRole("button", { name: "Open" }));
    expect(screen.getByText(/you authored this workflow item or its current immutable revision/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve attested revision" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request Changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });
});
