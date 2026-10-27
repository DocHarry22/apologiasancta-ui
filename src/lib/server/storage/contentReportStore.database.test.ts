import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentReport } from "@/lib/contentReports";
const state = vi.hoisted(() => ({ rows: new Map<string, { key: string; report: ContentReport }>(), dialect: "postgres", fail: false, sql: [] as string[], transaction: Promise.resolve() as Promise<unknown> }));
vi.mock("./workflowDatabase", () => {
  const db = {
    get dialect() { return state.dialect; },
    async query(sql: string, values: unknown[] = []) {
      state.sql.push(sql);
      if (state.fail) throw new Error("database offline");
      if (sql.startsWith("CREATE")) return [];
      if (sql.startsWith("INSERT")) {
        if (![...state.rows.values()].some(row => row.key === values[1])) state.rows.set(String(values[0]), { key: String(values[1]), report: JSON.parse(String(values[4])) });
        return [];
      }
      if (sql.startsWith("SELECT") && sql.includes("dedupe_key")) return [...state.rows.values()].filter(row => row.key === values[0]).map(row => ({ payload: row.report }));
      if (sql.startsWith("SELECT") && sql.includes("FOR UPDATE")) {
        const row = state.rows.get(String(values[0]));
        return row ? [{ payload: row.report }] : [];
      }
      if (sql.startsWith("UPDATE")) {
        const row = state.rows.get(String(values[3]))!;
        row.report = JSON.parse(String(values[2]));
        return [];
      }
      if (sql.startsWith("SELECT")) return [...state.rows.values()].filter(row => !values[0] || row.report.status === values[0]).map(row => ({ payload: row.report }));
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    transaction<T>(operation: (tx: unknown) => Promise<T>) {
      const pending = state.transaction.then(() => operation(db));
      state.transaction = pending.catch(() => undefined);
      return pending;
    },
  };
  return { workflowDatabaseEnabled: () => true, getWorkflowDatabase: async () => db, parseWorkflowDatabaseJson: (value: unknown) => value };
});
vi.mock("./jsonStore", () => ({ JsonStore: class { read() { throw new Error("File fallback forbidden"); } write() { throw new Error("File fallback forbidden"); } }, newId: () => crypto.randomUUID() }));
import { listContentReports, reviewContentReport, submitContentReport, ReportConflictError } from "./contentReportStore";
const input = () => ({ target: { app: "research", contentType: "claim", contentId: "claim:1", revisionId: "revision:1", title: "A claim", snapshot: { proposition: "Original claim" } }, reason: "unfair_representation", details: "Check the source context.", sourceUrl: "/research" });
beforeEach(() => { state.rows.clear(); state.sql.length = 0; state.fail = false; });
describe("database correction records", () => {
  for (const dialect of ["postgres", "mysql"]) it(`persists and deduplicates reports using ${dialect} storage`, async () => {
    state.dialect = dialect;
    const first = await submitContentReport(input(), "reader");
    const retry = await submitContentReport(input(), "reader");
    expect(retry.id).toBe(first.id);
    expect(state.rows.size).toBe(1);
    const insert = state.sql.find(sql => sql.startsWith("INSERT"))!;
    expect(insert).toContain(dialect === "postgres" ? "ON CONFLICT" : "ON DUPLICATE KEY");
    expect((await listContentReports("open"))[0].target.revisionId).toBe("revision:1");
  });
  it("locks report rows and rejects a concurrent stale editorial decision", async () => {
    const report = await submitContentReport(input(), "reader");
    const results = await Promise.allSettled([reviewContentReport(report.id, { status: "in_review", note: "Reviewing the claim context.", version: 1 }, "editor:1"), reviewContentReport(report.id, { status: "dismissed", note: "This decision uses an older version.", version: 1 }, "editor:2")]);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: expect.any(ReportConflictError) });
    expect(state.sql.some(sql => sql.includes("FOR UPDATE"))).toBe(true);
    expect((await listContentReports("in_review"))[0].history).toHaveLength(2);
  });
  it("fails closed when the configured database is unavailable", async () => {
    state.fail = true;
    await expect(submitContentReport(input(), "reader")).rejects.toThrow("database offline");
    expect(state.rows.size).toBe(0);
  });
});
