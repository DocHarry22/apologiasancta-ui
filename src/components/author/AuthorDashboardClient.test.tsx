// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DraftQuestion } from "@/lib/contentWorkflow";
import type { CurrentUser } from "@/lib/server/currentUser";
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

const superAdmin: CurrentUser = {
  id: "publisher-1",
  displayName: "Publisher One",
  role: "super_admin",
  accountType: "staff",
  source: "database",
};

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
    expect(screen.getByText("Approved item question")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Awaiting theological review" })).toBeInTheDocument();
    expect(screen.getByText("Submitted item question")).toBeInTheDocument();

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
});
