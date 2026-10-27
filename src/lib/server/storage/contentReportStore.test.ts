import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { displayedRevision } from "@/lib/contentReports";

let store: typeof import("./contentReportStore");
let directory: string;
const input = () => ({ target: { app: "quiz", contentType: "question", contentId: "question:1", revisionId: "revision:old", title: "Which answer?", snapshot: { prompt: "Which answer?", options: ["A", "B"], publishedRevisionId: "revision:old" } }, reason: "incorrect_answer", details: "Answer A needs review", sourceUrl: "/mobile" });

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "apologia-content-reports-"));
  vi.stubEnv("APP_DATA_DIR", directory);
  vi.stubEnv("APP_STORAGE_DRIVER", "file");
  store = await import("./contentReportStore");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  if (directory && path.dirname(directory) === path.resolve(tmpdir()) && path.basename(directory).startsWith("apologia-content-reports-")) await rm(directory, { recursive: true, force: true });
});

describe("revision-bound corrections", () => {
  it("keeps the reported revision and content after the reader moves on", () => {
    const body = input();
    const report = store.normalizeReport(body, "reader");
    body.target.snapshot.prompt = "New wording";
    body.target.revisionId = "revision:new";
    expect(report.target.revisionId).toBe("revision:old");
    expect(report.target.snapshot).toMatchObject({ prompt: "Which answer?" });
  });

  it("fingerprints unversioned content consistently and distinguishes edits", () => {
    const body = input();
    const target = { ...body.target, revisionId: undefined };
    const first = store.normalizeReport({ ...body, target }, "reader");
    const reordered = store.normalizeReport({ ...body, target: { ...target, snapshot: { publishedRevisionId: "revision:old", options: ["A", "B"], prompt: "Which answer?" } } }, "reader");
    const edited = store.normalizeReport({ ...body, target: { ...target, snapshot: { prompt: "Edited" } } }, "reader");
    expect(first.target.revisionId).toBe(`sha256:${first.target.contentHash}`);
    expect(reordered.target.contentHash).toBe(first.target.contentHash);
    expect(edited.target.revisionId).not.toBe(first.target.revisionId);
  });

  it("uses the published revision before any unpublished working revision", () => {
    expect(displayedRevision({ publishedRevisionId: "published:1", revisionId: "draft:2" })).toBe("published:1");
    expect(displayedRevision({ version: 3 })).toBe("version:3");
    expect(displayedRevision({ version: "3" })).toBeUndefined();
  });

  it("rejects invalid reasons, targets, empty other issues, unsafe URLs, and oversized evidence", () => {
    for (const patch of [{ reason: "fake" }, { target: {} }, { reason: "other", details: "" }, { sourceUrl: "javascript:alert(1)" }, { target: { ...input().target, snapshot: { text: "a".repeat(129_000) } } }]) {
      expect(() => store.normalizeReport({ ...input(), ...patch }, "reader")).toThrow(store.ReportInputError);
    }
  });

  it("deduplicates concurrent retries durably without merging different revisions", async () => {
    const [first, retry] = await Promise.all([store.submitContentReport(input(), "reader"), store.submitContentReport(input(), "reader")]);
    expect(retry.id).toBe(first.id);
    const revised = await store.submitContentReport({ ...input(), target: { ...input().target, revisionId: "revision:new" } }, "reader");
    expect(revised.id).not.toBe(first.id);
    const saved = JSON.parse(await readFile(path.join(directory, "content-reports.json"), "utf8"));
    expect(saved).toHaveLength(2);
    expect(saved[0].target.revisionId).toBe("revision:old");
  });

  it("records reviewer history, requires a correction reference and prevents stale overwrites", async () => {
    const report = await store.submitContentReport(input(), "another-reader");
    const reviewing = await store.reviewContentReport(report.id, { version: 1, status: "in_review", note: "Checking the primary source." }, "editor");
    expect(reviewing?.history).toHaveLength(2);
    await expect(store.reviewContentReport(report.id, { version: 1, status: "dismissed", note: "This stale update must fail." }, "other-editor")).rejects.toBeInstanceOf(store.ReportConflictError);
    expect(() => store.reviewedReport(reviewing!, { version: 2, status: "resolved", note: "A correction was published." }, "editor")).toThrow(store.ReportInputError);
    expect(() => store.reviewedReport(reviewing!, { version: 2, status: "resolved", note: "A correction was published.", correctedRevisionId: report.target.revisionId }, "editor")).toThrow(store.ReportInputError);
    const resolved = await store.reviewContentReport(report.id, { version: 2, status: "resolved", note: "A correction was published.", correctedRevisionId: "revision:corrected" }, "editor");
    expect(resolved?.target).toEqual(report.target);
    expect(resolved?.history.at(-1)?.correctedRevisionId).toBe("revision:corrected");
    expect((await store.listContentReports("resolved")).map(value => value.id)).toContain(report.id);
  });
});
