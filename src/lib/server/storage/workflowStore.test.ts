import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { REVIEW_ATTESTATION_STATEMENT } from "@/lib/editorialPolicy";
import type { CurrentUser } from "../currentUser";
import type { Question } from "@/types/content";

const author: CurrentUser = {
  id: "author-1",
  displayName: "Author One",
  role: "author",
  accountType: "staff",
  source: "transitional_env",
};

const reviewer: CurrentUser = {
  id: "reviewer-1",
  displayName: "Reviewer One",
  role: "reviewer",
  accountType: "staff",
  source: "transitional_env",
};

const publisher: CurrentUser = {
  id: "publisher-1",
  displayName: "Publisher One",
  role: "super_admin",
  accountType: "staff",
  source: "transitional_env",
};

const attestation = {
  doctrinalFidelityConfirmed: true as const,
  sourcesChecked: true as const,
  explanationSupported: true as const,
  charitableLanguageConfirmed: true as const,
  independentReviewConfirmed: true as const,
  statement: REVIEW_ATTESTATION_STATEMENT,
};

const sourcedQuestion: Question = {
  id: "edt_0001",
  topicId: "trinity",
  difficulty: 2,
  question: "Which source is listed for this editorial workflow test?",
  choices: { A: "Matthew 28:19", B: "A blog", C: "No source", D: "An anonymous post" },
  correctId: "A",
  teaching: {
    title: "The exact revision carries its sources",
    body: "The workflow requires a substantive explanation tied to the exact reviewed revision.",
    refs: ["Matthew 28:19"],
  },
  tags: ["editorial-test"],
  sourceReferences: [{ kind: "scripture", citation: "Matthew 28:19", locator: "Gospel of Matthew" }],
};

let dataDirectory = "";

beforeAll(async () => {
  dataDirectory = await mkdtemp(path.join(tmpdir(), "apologia-editorial-"));
  process.env.APP_DATA_DIR = dataDirectory;
  process.env.APP_STORAGE_DRIVER = "file";
  vi.resetModules();
});

afterAll(async () => {
  delete process.env.APP_DATA_DIR;
  delete process.env.APP_STORAGE_DRIVER;
  await rm(dataDirectory, { recursive: true, force: true });
});

describe("guarded editorial workflow", () => {
  it("requires structured primary sources before submission", async () => {
    const workflow = await import("./workflowStore");
    await expect(workflow.createWorkflowDraft(
      { ...sourcedQuestion, id: "edt_0002", sourceReferences: [], teaching: { ...sourcedQuestion.teaching, refs: [] } },
      author,
      ["trinity"],
      [],
      true
    )).rejects.toThrow("structured source reference");
  });

  it("blocks self-review and requires explicit independent attestation", async () => {
    const workflow = await import("./workflowStore");
    const draft = await workflow.createWorkflowDraft(sourcedQuestion, author, ["trinity"], [], true);

    await expect(workflow.transitionWorkflowItem(draft.id, "approved", author, {
      comment: "I checked this revision.",
      attestation,
      topicIds: ["trinity"],
    })).rejects.toThrow("cannot review or approve their own");

    await expect(workflow.transitionWorkflowItem(draft.id, "approved", reviewer, {
      comment: "Sources and explanation were checked.",
      topicIds: ["trinity"],
    })).rejects.toThrow("attestation is required");

    const approved = await workflow.transitionWorkflowItem(draft.id, "approved", reviewer, {
      comment: "Sources and explanation were checked against the cited passage.",
      attestation,
      topicIds: ["trinity"],
    });

    expect(approved.reviewerId).toBe(reviewer.id);
    expect(approved.reviewerId).not.toBe(approved.authorId);
    expect(approved.approvedRevisionId).toBe(approved.currentRevisionId);
    expect(approved.approvedContentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(approved.approvalAttestation?.independentReviewConfirmed).toBe(true);
  });

  it("retries one immutable publication through an idempotent outbox", async () => {
    const workflow = await import("./workflowStore");
    const draft = await workflow.createWorkflowDraft({ ...sourcedQuestion, id: "edt_0003" }, author, ["trinity"], [], true);
    const approved = await workflow.transitionWorkflowItem(draft.id, "approved", reviewer, {
      comment: "Sources and explanation were checked against the cited passage.",
      attestation,
      topicIds: ["trinity"],
    });

    const firstClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    expect(firstClaim.alreadyCompleted).toBe(false);
    expect(firstClaim.idempotencyKey).toContain(firstClaim.item.contentHash);

    await expect(workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []))
      .rejects.toThrow("already in progress");

    const failed = await workflow.failWorkflowPublication(firstClaim, publisher, "temporary engine failure");
    expect(failed.status).toBe("approved");

    const retryClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    expect(retryClaim.idempotencyKey).toBe(firstClaim.idempotencyKey);
    expect(retryClaim.question).toEqual(firstClaim.question);

    const published = await workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 1 });
    expect(published.status).toBe("published");
    expect(published.publishTarget).toBe("engine");

    const replay = await workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []);
    expect(replay.alreadyCompleted).toBe(true);
    expect(replay.idempotencyKey).toBe(firstClaim.idempotencyKey);
  });
});
