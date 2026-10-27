import { createHash } from "node:crypto";
import { reportReasons, type ContentReport, type ReportStatus, type ReportTarget } from "@/lib/contentReports";
import { JsonStore, newId } from "./jsonStore";
import { getWorkflowDatabase, parseWorkflowDatabaseJson, workflowDatabaseEnabled } from "./workflowDatabase";

export class ReportInputError extends Error {}
export class ReportConflictError extends Error {}
const file = new JsonStore<ContentReport[]>("content-reports.json", []);
let queue: Promise<unknown> = Promise.resolve();
let schema: Promise<void> | undefined;

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const pending = queue.then(operation, operation);
  queue = pending.catch(() => undefined);
  return pending;
}

function text(value: unknown, name: string, max: number, required = true): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new ReportInputError(`Invalid ${name}.`);
  return value.trim();
}

function canonical(value: unknown, depth = 0): string {
  if (depth > 30) throw new ReportInputError("Content snapshot is too deeply nested.");
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(entry => canonical(entry, depth + 1)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key], depth + 1)}`).join(",")}}`;
}

export function normalizeReport(input: Record<string, unknown>, reporterId: string): ContentReport {
  const raw = input.target as Partial<ReportTarget> | undefined;
  if (!raw || !["quiz", "learn", "research", "graph"].includes(raw.app || "") || !["question", "lesson", "claim"].includes(raw.contentType || "")) throw new ReportInputError("Choose valid content to report.");
  if (!raw.snapshot || typeof raw.snapshot !== "object") throw new ReportInputError("The displayed content snapshot is required.");
  const snapshot = canonical(raw.snapshot);
  if (Buffer.byteLength(snapshot) > 128_000) throw new ReportInputError("The content snapshot is too large.");
  const contentHash = createHash("sha256").update(snapshot).digest("hex");
  if (typeof input.reason !== "string" || !Object.hasOwn(reportReasons, input.reason)) throw new ReportInputError("Choose a report reason.");
  const details = text(input.details ?? "", "details", 4000, false);
  if (input.reason === "other" && details.length < 10) throw new ReportInputError("Please describe the content issue (at least 10 characters).");
  const sourceUrl = text(input.sourceUrl ?? "", "source URL", 2000, false);
  if (sourceUrl && !/^\/(?!\/)/.test(sourceUrl)) {
    try {
      const url = new URL(sourceUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { throw new ReportInputError("Invalid source URL."); }
  }
  const now = new Date().toISOString();
  return {
    id: newId("report"),
    target: {
      app: raw.app!, contentType: raw.contentType!,
      contentId: text(raw.contentId, "content ID", 300), title: text(raw.title, "content title", 1200),
      revisionId: raw.revisionId === undefined ? `sha256:${contentHash}` : text(raw.revisionId, "revision ID", 300),
      contentHash, snapshot: JSON.parse(snapshot),
    },
    reason: input.reason as ContentReport["reason"], details, sourceUrl, reporterId,
    status: "open", version: 1, createdAt: now, updatedAt: now,
    history: [{ actorId: reporterId, status: "open", note: "Issue reported", createdAt: now }],
  };
}

function dedupeKey(report: ContentReport): string {
  return createHash("sha256").update(JSON.stringify([report.reporterId, report.target.app, report.target.contentType, report.target.contentId, report.target.revisionId, report.target.contentHash, report.reason, report.details])).digest("hex");
}

async function database() {
  const db = await getWorkflowDatabase();
  schema ??= db.query(`CREATE TABLE IF NOT EXISTS content_correction_reports (
    id VARCHAR(191) PRIMARY KEY,
    dedupe_key CHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL,
    version INTEGER NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    payload ${db.dialect === "postgres" ? "JSONB" : "JSON"} NOT NULL
  )`).then(() => undefined).catch(error => { schema = undefined; throw error; });
  await schema;
  return db;
}

function fromRow(row: { payload: unknown }): ContentReport {
  return parseWorkflowDatabaseJson<ContentReport>(row.payload);
}

export async function submitContentReport(input: Record<string, unknown>, reporterId: string): Promise<ContentReport> {
  const report = normalizeReport(input, reporterId);
  const key = dedupeKey(report);
  if (workflowDatabaseEnabled()) {
    const db = await database();
    const cast = db.dialect === "postgres" ? "?::jsonb" : "?";
    const conflict = db.dialect === "postgres" ? "ON CONFLICT (dedupe_key) DO NOTHING" : "ON DUPLICATE KEY UPDATE dedupe_key = VALUES(dedupe_key)";
    await db.query(`INSERT INTO content_correction_reports (id,dedupe_key,status,version,created_at,payload) VALUES (?,?,?,1,?,${cast}) ${conflict}`, [report.id, key, report.status, report.createdAt, JSON.stringify(report)]);
    const rows = await db.query<{ payload: unknown }>("SELECT payload FROM content_correction_reports WHERE dedupe_key = ?", [key]);
    return fromRow(rows[0]);
  }
  return serial(async () => {
    const reports = await file.read();
    const existing = reports.find(entry => dedupeKey(entry) === key);
    if (existing) return existing;
    await file.write([...reports, report]);
    return report;
  });
}

export async function listContentReports(status?: string): Promise<ContentReport[]> {
  if (status && !["open", "in_review", "resolved", "dismissed"].includes(status)) throw new ReportInputError("Invalid report status.");
  if (workflowDatabaseEnabled()) {
    const db = await database();
    const rows = await db.query<{ payload: unknown }>(`SELECT payload FROM content_correction_reports ${status ? "WHERE status = ?" : ""} ORDER BY created_at DESC, id DESC LIMIT 200`, status ? [status] : []);
    return rows.map(fromRow);
  }
  return (await file.read()).filter(report => !status || report.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
}

export function reviewedReport(report: ContentReport, input: Record<string, unknown>, actorId: string): ContentReport {
  if (input.version !== report.version) throw new ReportConflictError("This report changed. Refresh before reviewing it.");
  const status = input.status as ReportStatus;
  if (!["open", "in_review", "resolved", "dismissed"].includes(status) || status === report.status) throw new ReportInputError("Choose a new report status.");
  const note = text(input.note, "editorial note", 4000);
  if (note.length < 10) throw new ReportInputError("An editorial note of at least 10 characters is required.");
  const correctedRevisionId = status === "resolved" ? text(input.correctedRevisionId, "corrected revision ID", 300) : undefined;
  if (correctedRevisionId === report.target.revisionId) throw new ReportInputError("Link the new corrected revision, not the reported revision.");
  const now = new Date().toISOString();
  return { ...report, status, version: report.version + 1, updatedAt: now, history: [...report.history, { actorId, status, note, ...(correctedRevisionId ? { correctedRevisionId } : {}), createdAt: now }] };
}

export async function reviewContentReport(id: string, input: Record<string, unknown>, actorId: string): Promise<ContentReport | null> {
  if (workflowDatabaseEnabled()) {
    const db = await database();
    return db.transaction(async tx => {
      const rows = await tx.query<{ payload: unknown }>("SELECT payload FROM content_correction_reports WHERE id = ? FOR UPDATE", [id]);
      if (!rows[0]) return null;
      const report = reviewedReport(fromRow(rows[0]), input, actorId);
      await tx.query(`UPDATE content_correction_reports SET status = ?, version = ?, payload = ${tx.dialect === "postgres" ? "?::jsonb" : "?"} WHERE id = ?`, [report.status, report.version, JSON.stringify(report), id]);
      return report;
    });
  }
  return serial(async () => {
    const reports = await file.read();
    const index = reports.findIndex(report => report.id === id);
    if (index === -1) return null;
    const report = reviewedReport(reports[index], input, actorId);
    reports[index] = report;
    await file.write(reports);
    return report;
  });
}
