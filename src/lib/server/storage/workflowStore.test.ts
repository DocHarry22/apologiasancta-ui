import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { REVIEW_ATTESTATION_STATEMENT } from "@/lib/editorialPolicy";
import type { CurrentUser } from "../currentUser";
import type { Question } from "@/types/content";
import type { WorkflowDatabase, WorkflowDatabaseExecutor } from "./workflowDatabase";
import type { WorkflowFileState } from "./workflowStore";
import type { WorkflowHistoryEvent, WorkflowItem } from "./types";

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

async function patchStoredWorkflowItem(id: string, patch: Partial<WorkflowItem>): Promise<void> {
  const filePath = path.join(dataDirectory, "editorial-workflow.json");
  const state = JSON.parse(await readFile(filePath, "utf8")) as WorkflowFileState;
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Workflow test fixture ${id} was not found.`);
  state.items[index] = { ...state.items[index], ...patch };
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function readWorkflowFileState(): Promise<WorkflowFileState> {
  return JSON.parse(
    await readFile(path.join(dataDirectory, "editorial-workflow.json"), "utf8")
  ) as WorkflowFileState;
}

async function writeWorkflowFileState(state: WorkflowFileState): Promise<void> {
  await writeFile(
    path.join(dataDirectory, "editorial-workflow.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8"
  );
}

async function patchStoredWorkflowOutbox(
  identifier: string,
  patch: Partial<WorkflowFileState["outbox"][number]>
): Promise<void> {
  const state = await readWorkflowFileState();
  const index = state.outbox.findIndex((record) => (
    record.idempotencyKey === identifier || record.workflowItemId === identifier
  ));
  if (index < 0) throw new Error(`Publication outbox test fixture ${identifier} was not found.`);
  state.outbox[index] = { ...state.outbox[index], ...patch };
  await writeWorkflowFileState(state);
}

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

  it("keeps invalid public IDs visible on drafts but blocks every submission path", async () => {
    const workflow = await import("./workflowStore");
    const invalidIds = ["", "invalid question id!"];

    for (const [index, questionId] of invalidIds.entries()) {
      const question = { ...sourcedQuestion, id: questionId };
      await expect(workflow.createWorkflowDraft(question, author, ["trinity"], [], true))
        .rejects.toThrow("blocking validation issues");

      const draft = await workflow.createWorkflowDraft(question, author, ["trinity"], [], false);
      expect(draft.status).toBe("draft");
      expect(draft.questionId).toBe(questionId);
      expect(draft.validationIssues).toContain(index === 0
        ? "Question ID is required."
        : "Question ID may only contain letters, numbers, underscores, and hyphens.");

      const storedDraft = await workflow.getWorkflowItem(draft.id);
      expect(storedDraft?.questionId).toBe(questionId);
      await expect(workflow.transitionWorkflowItem(draft.id, "submitted", author, { topicIds: ["trinity"] }))
        .rejects.toThrow("blocking validation issues");
    }
  });

  it("requires changed content in a new immutable revision after changes are requested", async () => {
    const workflow = await import("./workflowStore");
    const draft = await workflow.createWorkflowDraft(
      { ...sourcedQuestion, id: "edt_0005" },
      author,
      ["trinity"],
      [],
      false
    );

    const firstSubmission = await workflow.transitionWorkflowItem(draft.id, "submitted", author, { topicIds: ["trinity"] });
    expect(firstSubmission).toMatchObject({
      status: "submitted",
      currentRevisionId: draft.currentRevisionId,
      contentHash: draft.contentHash,
    });

    const changesRequested = await workflow.transitionWorkflowItem(firstSubmission.id, "changes_requested", reviewer, {
      comment: "The explanation must distinguish the source from the unsupported alternative.",
      doctrinalFlag: true,
      topicIds: ["trinity"],
    });
    const flaggedReview = changesRequested.reviewComments.at(-1)!;
    const evidenceBeforeBlockedRetry = {
      version: changesRequested.version,
      reviewCount: changesRequested.reviewComments.length,
      historyCount: changesRequested.history.length,
    };
    expect(changesRequested).toMatchObject({
      status: "changes_requested",
      changesRequestedRevisionId: firstSubmission.currentRevisionId,
      changesRequestedContentHash: firstSubmission.contentHash,
    });
    expect(flaggedReview).toMatchObject({
      decision: "changes_requested",
      revisionId: firstSubmission.currentRevisionId,
      contentHash: firstSubmission.contentHash,
      doctrinalFlag: true,
    });

    await expect(workflow.transitionWorkflowItem(changesRequested.id, "submitted", author, { topicIds: ["trinity"] }))
      .rejects.toThrow("new immutable revision with changed content");

    const unchangedAfterBlockedRetry = await workflow.getWorkflowItem(changesRequested.id);
    expect(unchangedAfterBlockedRetry).toMatchObject({
      status: "changes_requested",
      version: evidenceBeforeBlockedRetry.version,
      changesRequestedRevisionId: firstSubmission.currentRevisionId,
      changesRequestedContentHash: firstSubmission.contentHash,
    });
    expect(unchangedAfterBlockedRetry?.reviewComments).toHaveLength(evidenceBeforeBlockedRetry.reviewCount);
    expect(unchangedAfterBlockedRetry?.history).toHaveLength(evidenceBeforeBlockedRetry.historyCount);
    expect(unchangedAfterBlockedRetry?.reviewComments.at(-1)).toEqual(flaggedReview);

    const noOpRevision = await workflow.updateWorkflowDraft(changesRequested.id, {
      ...sourcedQuestion,
      id: "edt_0005",
    }, author, ["trinity"], []);
    expect(noOpRevision.currentRevisionId).not.toBe(firstSubmission.currentRevisionId);
    expect(noOpRevision.contentHash).toBe(firstSubmission.contentHash);
    await expect(workflow.transitionWorkflowItem(noOpRevision.id, "submitted", author, { topicIds: ["trinity"] }))
      .rejects.toThrow("new immutable revision with changed content");

    const revised = await workflow.updateWorkflowDraft(noOpRevision.id, {
      ...sourcedQuestion,
      id: "edt_0005",
      teaching: {
        ...sourcedQuestion.teaching,
        body: "The cited Gospel text supports the correct answer, while the unsupported alternative has no primary-source basis.",
      },
    }, author, ["trinity"], []);
    expect(revised.currentRevisionId).not.toBe(firstSubmission.currentRevisionId);
    expect(revised.contentHash).not.toBe(firstSubmission.contentHash);
    expect(revised.revisions).toHaveLength(3);
    expect(revised.reviewComments.at(-1)).toEqual(flaggedReview);

    const resubmitted = await workflow.transitionWorkflowItem(revised.id, "submitted", author, { topicIds: ["trinity"] });
    expect(resubmitted).toMatchObject({
      status: "submitted",
      currentRevisionId: revised.currentRevisionId,
      contentHash: revised.contentHash,
      changesRequestedRevisionId: firstSubmission.currentRevisionId,
      changesRequestedContentHash: firstSubmission.contentHash,
      reviewerId: undefined,
      reviewerName: undefined,
    });
    expect(resubmitted.reviewComments.at(-1)).toEqual(flaggedReview);
    expect(resubmitted.doctrinalFlags).toContain(reviewer.id);

    await new Promise((resolve) => setTimeout(resolve, 2));
    const secondChangesRequest = await workflow.transitionWorkflowItem(resubmitted.id, "changes_requested", reviewer, {
      comment: "The revised explanation now needs a more precise distinction between public and internal identifiers.",
      referenceFlag: true,
      topicIds: ["trinity"],
    });
    expect(secondChangesRequest).toMatchObject({
      changesRequestedRevisionId: revised.currentRevisionId,
      changesRequestedContentHash: revised.contentHash,
    });
    await expect(workflow.transitionWorkflowItem(secondChangesRequest.id, "submitted", author, { topicIds: ["trinity"] }))
      .rejects.toThrow("new immutable revision with changed content");

    const secondRevision = await workflow.updateWorkflowDraft(secondChangesRequest.id, {
      ...sourcedQuestion,
      id: "edt_0005",
      teaching: {
        ...sourcedQuestion.teaching,
        body: "The public question identifier is distinct from internal workflow, revision, and event identifiers, while the primary citation supports the teaching itself.",
      },
    }, author, ["trinity"], []);
    const secondResubmission = await workflow.transitionWorkflowItem(secondRevision.id, "submitted", author, { topicIds: ["trinity"] });
    expect(secondResubmission).toMatchObject({
      status: "submitted",
      changesRequestedRevisionId: revised.currentRevisionId,
      changesRequestedContentHash: revised.contentHash,
    });
    expect(secondResubmission.reviewComments).toHaveLength(2);
  });

  it("fails closed when requested-change projection evidence diverges after file reload", async () => {
    const workflow = await import("./workflowStore");
    const submitted = await workflow.createWorkflowDraft(
      { ...sourcedQuestion, id: "edt_0006" },
      author,
      ["trinity"],
      [],
      true
    );
    const changesRequested = await workflow.transitionWorkflowItem(submitted.id, "changes_requested", reviewer, {
      comment: "The stored request-change evidence must remain bound to this exact revision.",
      topicIds: ["trinity"],
    });

    await patchStoredWorkflowItem(changesRequested.id, {
      changesRequestedRevisionId: "wf_rev_divergent_projection",
      changesRequestedContentHash: "b".repeat(64),
    });
    const reloaded = await workflow.getWorkflowItem(changesRequested.id);
    expect(reloaded?.changesRequestedEvidenceConflict).toBe(true);
    await expect(workflow.transitionWorkflowItem(changesRequested.id, "submitted", author, { topicIds: ["trinity"] }))
      .rejects.toThrow("audit evidence is inconsistent");
  });

  it("requires an edited revision when a legacy approval is reopened after file reload", async () => {
    const workflow = await import("./workflowStore");
    const submitted = await workflow.createWorkflowDraft(
      { ...sourcedQuestion, id: "edt_0008" },
      author,
      ["trinity"],
      [],
      true
    );
    const approved = await workflow.transitionWorkflowItem(submitted.id, "approved", reviewer, {
      comment: "This approval will be stripped to emulate an unbound legacy approval record.",
      attestation,
      topicIds: ["trinity"],
    });
    await patchStoredWorkflowItem(approved.id, {
      approvedRevisionId: undefined,
      approvedContentHash: undefined,
      approvalAttestation: undefined,
    });

    const reopened = await workflow.getWorkflowItem(approved.id);
    expect(reopened).toMatchObject({
      status: "changes_requested",
      changesRequestedRevisionId: approved.currentRevisionId,
      changesRequestedContentHash: approved.contentHash,
    });
    await expect(workflow.transitionWorkflowItem(approved.id, "submitted", author, { topicIds: ["trinity"] }))
      .rejects.toThrow("new immutable revision with changed content");
  });

  it("blocks the current revision creator from review and reasserts independence at publication", async () => {
    const workflow = await import("./workflowStore");
    const submitted = await workflow.createWorkflowDraft(
      { ...sourcedQuestion, id: "edt_0007" },
      author,
      ["trinity"],
      [],
      true
    );
    const changesRequested = await workflow.transitionWorkflowItem(submitted.id, "changes_requested", reviewer, {
      comment: "Please make the explanation more explicit before another independent review.",
      topicIds: ["trinity"],
    });
    const adminRevision = await workflow.updateWorkflowDraft(changesRequested.id, {
      ...sourcedQuestion,
      id: "edt_0007",
      teaching: {
        ...sourcedQuestion.teaching,
        body: "This revision was authored by an administrator, so a different human must review its exact source-backed content.",
      },
    }, publisher, ["trinity"], []);
    const resubmitted = await workflow.transitionWorkflowItem(adminRevision.id, "submitted", publisher, { topicIds: ["trinity"] });

    await expect(workflow.transitionWorkflowItem(resubmitted.id, "approved", publisher, {
      comment: "I should not be allowed to approve the exact revision that I authored.",
      attestation,
      topicIds: ["trinity"],
    })).rejects.toThrow("cannot review or approve their own revision");

    const approved = await workflow.transitionWorkflowItem(resubmitted.id, "approved", reviewer, {
      comment: "I independently checked the administrator-authored revision and its primary citation.",
      attestation,
      topicIds: ["trinity"],
    });
    expect(approved.reviewerId).toBe(reviewer.id);
    expect(approved.revisions.find((revision) => revision.id === approved.currentRevisionId)?.createdBy).toBe(publisher.id);

    await patchStoredWorkflowItem(approved.id, { reviewerId: publisher.id, reviewerName: publisher.displayName });
    await expect(workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []))
      .rejects.toThrow("independent from the approved revision's author");

    await patchStoredWorkflowItem(approved.id, { reviewerId: reviewer.id, reviewerName: reviewer.displayName });
    const claim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    expect(claim.question.id).toBe("edt_0007");
    await workflow.failWorkflowPublication(claim, publisher, "test cleanup");
  });

  it("requires embedded append-only approval evidence before a file publication claim", async () => {
    const workflow = await import("./workflowStore");
    const submitted = await workflow.createWorkflowDraft(
      { ...sourcedQuestion, id: "edt_0010" },
      author,
      ["trinity"],
      [],
      true
    );
    const approved = await workflow.transitionWorkflowItem(submitted.id, "approved", reviewer, {
      comment: "This exact sourced revision was independently checked before the publication claim.",
      attestation,
      topicIds: ["trinity"],
    });
    const outboxCount = (await readWorkflowFileState()).outbox.length;

    await patchStoredWorkflowItem(approved.id, { reviewComments: [] });
    await expect(workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []))
      .rejects.toThrow("approval audit evidence is missing or inconsistent");
    expect((await readWorkflowFileState()).outbox).toHaveLength(outboxCount);

    await patchStoredWorkflowItem(approved.id, {
      reviewComments: approved.reviewComments.map((review) => (
        review.decision === "approved" ? { ...review, contentHash: "f".repeat(64) } : review
      )),
    });
    await expect(workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []))
      .rejects.toThrow("approval audit evidence is missing or inconsistent");
    expect((await readWorkflowFileState()).outbox).toHaveLength(outboxCount);

    await patchStoredWorkflowItem(approved.id, { reviewComments: approved.reviewComments });
    const claim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    expect(claim.question.id).toBe("edt_0010");
    expect((await readWorkflowFileState()).outbox).toHaveLength(outboxCount + 1);

    await expect(workflow.completeWorkflowPublication(
      { ...claim, idempotencyKey: "publish:wrong-claim-key" },
      publisher,
      { added: 1, updated: 0, bankSize: 1 }
    )).rejects.toThrow("Publication claim evidence is missing or inconsistent");

    await patchStoredWorkflowItem(approved.id, { publicationIdempotencyKey: undefined });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Publication claim evidence is missing or inconsistent");
    await patchStoredWorkflowItem(approved.id, { publicationIdempotencyKey: claim.idempotencyKey });

    await patchStoredWorkflowItem(approved.id, { currentRevisionId: "wf_rev_corrupted_after_claim" });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Approved revision does not match the current immutable revision");

    await patchStoredWorkflowItem(approved.id, {
      currentRevisionId: approved.currentRevisionId,
      contentHash: "e".repeat(64),
    });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Approved revision does not match the current immutable revision");

    for (const invalidCreator of [undefined, ""] as const) {
      await patchStoredWorkflowItem(approved.id, {
        contentHash: approved.contentHash,
        currentRevisionId: approved.currentRevisionId,
        revisions: approved.revisions.map((revision) => (
          revision.id === approved.currentRevisionId
            ? { ...revision, createdBy: invalidCreator as unknown as string }
            : revision
        )),
      });
      await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("known author for the approved revision");
    }
    const invalidCreatorState = await readWorkflowFileState();
    expect(invalidCreatorState.items.find((item) => item.id === approved.id)?.status).toBe("approved");
    expect(invalidCreatorState.outbox.find((record) => record.idempotencyKey === claim.idempotencyKey)?.status)
      .toBe("processing");

    await patchStoredWorkflowItem(approved.id, {
      contentHash: approved.contentHash,
      currentRevisionId: approved.currentRevisionId,
      revisions: approved.revisions.map((revision) => (
        revision.id === approved.currentRevisionId ? { ...revision, createdBy: reviewer.id } : revision
      )),
    });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("reviewer independent from the approved revision's author");

    await patchStoredWorkflowItem(approved.id, {
      revisions: approved.revisions.map((revision) => (
        revision.id === approved.currentRevisionId
          ? { ...revision, question: { ...revision.question, question: "Corrupted after publication claim." } }
          : revision
      )),
    });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Approved revision content hash verification failed");

    await patchStoredWorkflowItem(approved.id, {
      revisions: approved.revisions,
      question: "Corrupted mutable workflow projection after publication claim.",
    });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Current workflow projection no longer matches the approved revision");

    await patchStoredWorkflowItem(approved.id, { question: approved.question, revisions: [] });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Approved revision snapshot is unavailable or invalid");
    await patchStoredWorkflowItem(approved.id, { revisions: approved.revisions });

    await patchStoredWorkflowOutbox(approved.id, {
      revisionId: "wf_rev_corrupted_outbox",
      contentHash: "d".repeat(64),
    });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
    await patchStoredWorkflowOutbox(approved.id, {
      revisionId: approved.approvedRevisionId,
      contentHash: approved.approvedContentHash,
      workflowItemId: "wf_corrupted_outbox_owner",
    });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
    await patchStoredWorkflowOutbox(claim.idempotencyKey, {
      workflowItemId: approved.id,
      idempotencyKey: "publish:corrupted-outbox-key",
    });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
    await patchStoredWorkflowOutbox(approved.id, {
      idempotencyKey: claim.idempotencyKey,
      status: "failed",
    });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Only a processing publication claim can be completed");
    await patchStoredWorkflowOutbox(approved.id, { status: "processing" });

    await patchStoredWorkflowItem(approved.id, { reviewComments: [] });
    await expect(workflow.completeWorkflowPublication(claim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("approval audit evidence is missing or inconsistent");
    const blockedCompletion = await readWorkflowFileState();
    expect(blockedCompletion.items.find((item) => item.id === approved.id)?.status).toBe("approved");
    expect(blockedCompletion.outbox.find((record) => record.idempotencyKey === claim.idempotencyKey)?.status)
      .toBe("processing");

    await patchStoredWorkflowItem(approved.id, { reviewComments: approved.reviewComments });
    await workflow.failWorkflowPublication(claim, publisher, "test cleanup");
  });

  it("revalidates empty and malformed public IDs at approval and publication", async () => {
    const workflow = await import("./workflowStore");
    const invalidIds = ["", "invalid question id!"];

    for (const [index, questionId] of invalidIds.entries()) {
      const approvalCandidate = await workflow.createWorkflowDraft(
        { ...sourcedQuestion, id: `edt_01${index.toString().padStart(2, "0")}` },
        author,
        ["trinity"],
        [],
        true
      );
      await patchStoredWorkflowItem(approvalCandidate.id, { questionId });
      await expect(workflow.transitionWorkflowItem(approvalCandidate.id, "approved", reviewer, {
        comment: "The exact revision and primary citation were independently checked.",
        attestation,
        topicIds: ["trinity"],
      })).rejects.toThrow("blocking validation issues");

      const publicationCandidate = await workflow.createWorkflowDraft(
        { ...sourcedQuestion, id: `edt_02${index.toString().padStart(2, "0")}` },
        author,
        ["trinity"],
        [],
        true
      );
      const approved = await workflow.transitionWorkflowItem(publicationCandidate.id, "approved", reviewer, {
        comment: "The exact revision and primary citation were independently checked.",
        attestation,
        topicIds: ["trinity"],
      });
      await patchStoredWorkflowItem(approved.id, { questionId });
      await expect(workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []))
        .rejects.toThrow("blocking validation issues");
    }
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

    const completedState = await readWorkflowFileState();
    const completedItem = completedState.items.find((item) => item.id === published.id)!;
    const completedOutbox = completedState.outbox.find((record) => record.idempotencyKey === retryClaim.idempotencyKey)!;
    const replay = await workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []);
    expect(replay.alreadyCompleted).toBe(true);
    expect(replay.idempotencyKey).toBe(firstClaim.idempotencyKey);
    const replayState = await readWorkflowFileState();
    const replayedItem = replayState.items.find((item) => item.id === published.id)!;
    const replayedOutbox = replayState.outbox.find((record) => record.idempotencyKey === replay.idempotencyKey)!;
    expect(replayedItem.version).toBe(completedItem.version);
    expect(replayedItem.history).toEqual(completedItem.history);
    expect(replayedOutbox).toEqual(completedOutbox);

    const duplicateCompletion = await workflow.completeWorkflowPublication(
      retryClaim,
      publisher,
      { added: 1, updated: 0, bankSize: 1 }
    );
    expect(duplicateCompletion.status).toBe("published");
    expect((await readWorkflowFileState()).items.find((item) => item.id === published.id)?.version)
      .toBe(completedItem.version);

    await patchStoredWorkflowItem(published.id, { status: "approved" });
    await expect(workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []))
      .rejects.toThrow("Completed publication evidence is missing or inconsistent");
    await expect(workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Completed publication evidence is missing or inconsistent");
    await patchStoredWorkflowItem(published.id, { status: "published" });

    await patchStoredWorkflowOutbox(published.id, {
      revisionId: "wf_rev_corrupted_completed_outbox",
      contentHash: "c".repeat(64),
    });
    await expect(workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []))
      .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
    await expect(workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Publication outbox evidence is missing or inconsistent");

    await patchStoredWorkflowOutbox(published.id, {
      revisionId: completedOutbox.revisionId,
      contentHash: completedOutbox.contentHash,
      workflowItemId: "wf_corrupted_completed_owner",
    });
    await expect(workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []))
      .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
    await expect(workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Publication outbox evidence is missing or inconsistent");

    await patchStoredWorkflowOutbox(retryClaim.idempotencyKey, {
      workflowItemId: completedOutbox.workflowItemId,
      idempotencyKey: "publish:corrupted-completed-key",
    });
    await expect(workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []))
      .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
    await expect(workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Publication outbox evidence is missing or inconsistent");

    await patchStoredWorkflowOutbox(published.id, {
      idempotencyKey: completedOutbox.idempotencyKey,
      completedAt: undefined,
    });
    await expect(workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []))
      .rejects.toThrow("Completed publication evidence is missing or inconsistent");
    await expect(workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Completed publication evidence is missing or inconsistent");

    await patchStoredWorkflowOutbox(published.id, { completedAt: completedOutbox.completedAt });
    await patchStoredWorkflowItem(published.id, { publicationIdempotencyKey: undefined });
    await expect(workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []))
      .rejects.toThrow("Completed publication evidence is missing or inconsistent");
    await expect(workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 1 }))
      .rejects.toThrow("Publication claim evidence is missing or inconsistent");
    await patchStoredWorkflowItem(published.id, { publicationIdempotencyKey: completedOutbox.idempotencyKey });

    await patchStoredWorkflowOutbox(published.id, { status: "failed" });
    await expect(workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []))
      .rejects.toThrow("Published content requires a coherent completed publication receipt");
    await patchStoredWorkflowOutbox(published.id, { status: "completed" });

    const missingReceiptState = await readWorkflowFileState();
    const receiptIndex = missingReceiptState.outbox.findIndex((record) => record.idempotencyKey === completedOutbox.idempotencyKey);
    expect(receiptIndex).toBeGreaterThanOrEqual(0);
    const [receipt] = missingReceiptState.outbox.splice(receiptIndex, 1);
    await writeWorkflowFileState(missingReceiptState);
    await expect(workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []))
      .rejects.toThrow("Published content requires a coherent completed publication receipt");
    missingReceiptState.outbox.splice(receiptIndex, 0, receipt);
    await writeWorkflowFileState(missingReceiptState);

    const restoredReplayState = await readWorkflowFileState();
    expect(restoredReplayState.items.find((item) => item.id === published.id)?.version).toBe(completedItem.version);
    expect(restoredReplayState.items.find((item) => item.id === published.id)?.history).toEqual(completedItem.history);
    expect(restoredReplayState.outbox.find((record) => record.idempotencyKey === completedOutbox.idempotencyKey)?.attempts)
      .toBe(completedOutbox.attempts);
  });

  it("idempotently reconciles file evidence without replacing newer database workflow state", async () => {
    const workflow = await import("./workflowStore");
    const draft = await workflow.createWorkflowDraft({ ...sourcedQuestion, id: "edt_0004" }, author, ["trinity"], [], false);
    const revised = await workflow.updateWorkflowDraft(draft.id, {
      ...sourcedQuestion,
      id: "edt_0004",
      teaching: { ...sourcedQuestion.teaching, body: "This second immutable revision retains its complete human review evidence." },
    }, author, ["trinity"], []);
    const submitted = await workflow.transitionWorkflowItem(revised.id, "submitted", author, { topicIds: ["trinity"] });
    const approved = await workflow.transitionWorkflowItem(submitted.id, "approved", reviewer, {
      comment: "The revised explanation and primary citation were independently checked.",
      attestation,
      topicIds: ["trinity"],
    });
    const firstClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    await workflow.failWorkflowPublication(firstClaim, publisher, "temporary migration-test failure");
    const retryClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    const published = await workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 4 });

    const fileState = JSON.parse(await readFile(path.join(dataDirectory, "editorial-workflow.json"), "utf8")) as WorkflowFileState;
    const sourceState: WorkflowFileState = {
      schemaVersion: 1,
      items: [published],
      outbox: fileState.outbox.filter((record) => record.workflowItemId === published.id),
    };
    expect(sourceState.items[0].revisions).toHaveLength(2);
    expect(sourceState.items[0].reviewComments).toHaveLength(1);
    expect(sourceState.outbox[0]).toMatchObject({ status: "completed", attempts: 2, engineResult: { bankSize: 4 } });

    const partialProjection = { ...published } as Record<string, unknown>;
    partialProjection.status = "approved";
    partialProjection.version = Math.max(1, published.version - 1);
    partialProjection.updatedAt = approved.updatedAt;
    delete partialProjection.publishedAt;
    delete partialProjection.publishTarget;
    delete partialProjection.reviewComments;
    delete partialProjection.history;

    const itemIds = new Map<string, string>([[published.id, published.id], ["already-in-db", "already-in-db"]]);
    const questionIds = new Map<string, string>([[published.questionId.toLowerCase(), published.id]]);
    const itemPayloads = new Map<string, unknown>([[published.id, partialProjection]]);
    const revisions = new Set<string>();
    const reviews = new Set<string>();
    const events = new Set<string>();
    const outbox = new Map<string, unknown[]>();
    const insertStatements: string[] = [];
    const executor: WorkflowDatabaseExecutor = {
      dialect: "postgres",
      async query<Row extends Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<Row[]> {
        if (/^INSERT\s/i.test(sql)) insertStatements.push(sql);
        if (sql.includes("INSERT INTO content_workflow_items")) {
          const id = String(values[0]);
          const normalized = String(values[2]);
          if (!itemIds.has(id) && !questionIds.has(normalized)) {
            itemIds.set(id, id);
            questionIds.set(normalized, id);
            itemPayloads.set(id, JSON.parse(String(values[9])));
          }
          return [];
        }
        if (sql.includes("SELECT id, payload FROM content_workflow_items WHERE id")) {
          const id = itemIds.get(String(values[0]));
          return (id ? [{ id, payload: itemPayloads.get(id) }] : []) as Row[];
        }
        if (sql.includes("SELECT id, payload FROM content_workflow_items WHERE question_id_normalized")) {
          const id = questionIds.get(String(values[0]));
          return (id ? [{ id, payload: itemPayloads.get(id) }] : []) as Row[];
        }
        if (sql.includes("UPDATE content_workflow_items SET")) {
          itemPayloads.set(String(values[10]), JSON.parse(String(values[8])));
          return [];
        }
        if (sql.includes("INSERT INTO content_workflow_revisions")) revisions.add(String(values[0]));
        if (sql.includes("INSERT INTO content_review_records")) reviews.add(String(values[0]));
        if (sql.includes("INSERT INTO content_workflow_events")) events.add(String(values[0]));
        if (sql.includes("INSERT INTO content_publication_outbox")) outbox.set(String(values[0]), values);
        return [];
      },
    };
    const database: WorkflowDatabase = {
      ...executor,
      async transaction<T>(operation: (transactionExecutor: WorkflowDatabaseExecutor) => Promise<T>): Promise<T> {
        return operation(executor);
      },
    };

    await workflow.migrateWorkflowSourcesToDatabase(database, sourceState, []);
    const firstReconciledJson = JSON.stringify(itemPayloads.get(published.id));
    await workflow.migrateWorkflowSourcesToDatabase(database, sourceState, []);

    const reconciled = itemPayloads.get(published.id) as WorkflowItem;
    expect(JSON.stringify(reconciled)).toBe(firstReconciledJson);
    expect(reconciled).toMatchObject({
      status: "published",
      version: published.version,
      revisionNumber: published.revisionNumber,
      currentRevisionId: published.currentRevisionId,
      contentHash: published.contentHash,
      publishTarget: "engine",
    });
    expect(reconciled.revisions.map((revision) => revision.id)).toEqual(published.revisions.map((revision) => revision.id));
    expect(reconciled.reviewComments.map((review) => review.id)).toEqual(published.reviewComments.map((review) => review.id));
    expect(new Set(reconciled.history.map((event) => event.id))).toEqual(new Set(published.history.map((event) => event.id)));

    const newerTimestamp = new Date(Date.parse(published.updatedAt) + 60_000).toISOString();
    const databaseOnlyEvent: WorkflowHistoryEvent = {
      id: "wf_evt_database_only",
      type: "archived",
      actorId: publisher.id,
      actorName: publisher.displayName,
      actorRole: publisher.role,
      createdAt: newerTimestamp,
      summary: "Archived after the source file snapshot was created.",
    };
    const newerDatabaseProjection: WorkflowItem = {
      ...reconciled,
      status: "archived",
      version: published.version + 1,
      updatedAt: newerTimestamp,
      archivedAt: newerTimestamp,
      history: [databaseOnlyEvent, ...reconciled.history],
    };
    itemPayloads.set(published.id, newerDatabaseProjection);

    await workflow.migrateWorkflowSourcesToDatabase(database, sourceState, []);
    const preserved = itemPayloads.get(published.id) as WorkflowItem;
    expect(preserved).toMatchObject({
      status: "archived",
      version: newerDatabaseProjection.version,
      updatedAt: newerTimestamp,
      archivedAt: newerTimestamp,
      contentHash: newerDatabaseProjection.contentHash,
    });
    expect(preserved.history.some((event) => event.id === databaseOnlyEvent.id)).toBe(true);
    expect(published.history.every((event) => preserved.history.some((candidate) => candidate.id === event.id))).toBe(true);

    expect(itemIds.has("already-in-db")).toBe(true);
    expect(revisions.size).toBe(published.revisions.length);
    expect(reviews.size).toBe(published.reviewComments.length);
    expect(events.size).toBe(published.history.length + 1);
    expect(outbox.size).toBe(1);
    expect(insertStatements.length).toBeGreaterThan(0);
    expect(insertStatements.every((sql) => sql.endsWith("ON CONFLICT DO NOTHING"))).toBe(true);
    const migratedOutbox = outbox.get(sourceState.outbox[0].idempotencyKey)!;
    expect(migratedOutbox[4]).toBe("completed");
    expect(migratedOutbox[5]).toBe(2);
    expect(JSON.parse(String(migratedOutbox[8]))).toMatchObject({ bankSize: 4 });
  });
});
