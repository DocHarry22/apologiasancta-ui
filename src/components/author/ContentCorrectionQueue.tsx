"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { reportReasons, type ContentReport, type ReportStatus } from "@/lib/contentReports";

function ReportReview({ report, onUpdated }: { report: ContentReport; onUpdated: () => void }) {
  const [status, setStatus] = useState<ReportStatus>(report.status === "open" ? "in_review" : report.status === "in_review" ? "resolved" : "open");
  const [note, setNote] = useState("");
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editor = report.target.contentType === "lesson" || report.target.app === "learn" ? "/author/learning" : report.target.contentType === "claim" ? "/author/knowledge" : "/author/authoring";
  async function save() {
    setBusy(true); setError("");
    try {
      const csrf = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      const security = await csrf.json();
      if (!csrf.ok || !security.csrfToken) throw new Error("Sign in again before reviewing this report.");
      const response = await fetch(`/api/workflow/reports/${encodeURIComponent(report.id)}`, { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": security.csrfToken }, body: JSON.stringify({ status, note, correctedRevisionId: revision, version: report.version }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update report.");
      onUpdated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update report."); }
    finally { setBusy(false); }
  }
  return <article className="rounded-xl border border-(--border) p-4">
    <p className="text-xs uppercase text-(--text-muted)">{report.target.app} · {report.target.contentType} · {report.status.replaceAll("_", " ")}</p>
    <h3 className="mt-2 text-lg font-semibold">{report.target.title}</h3>
    <p className="mt-2 font-semibold">{reportReasons[report.reason]}</p><p className="mt-2 whitespace-pre-wrap text-sm">{report.details || "No additional details supplied."}</p>
    <dl className="mt-3 space-y-1 break-all text-xs"><div><dt className="inline font-bold">Content: </dt><dd className="inline">{report.target.contentId}</dd></div><div><dt className="inline font-bold">Reported revision: </dt><dd className="inline">{report.target.revisionId}</dd></div><div><dt className="inline font-bold">Snapshot SHA-256: </dt><dd className="inline">{report.target.contentHash}</dd></div></dl>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Inspect reported version and history</summary><p className="mt-2">Reader-supplied evidence. Confirm it against the governed source before correcting content.</p><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-(--surface-elevated) p-3 text-xs">{JSON.stringify(report.target.snapshot, null, 2)}</pre><ul className="mt-3 space-y-2">{report.history.map((event, index) => <li key={index}>{event.createdAt} · {event.status.replaceAll("_", " ")} · {event.note}{event.correctedRevisionId ? ` · Corrected revision: ${event.correctedRevisionId}` : ""}</li>)}</ul></details>
    <Link href={editor} className="btn-secondary my-3 inline-flex">Open content editor</Link>
    <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-3">
      <label className="block text-sm">Editorial status<select aria-label="Editorial status" value={status} onChange={event => setStatus(event.target.value as ReportStatus)} className="form-control mt-1">{(["open", "in_review", "resolved", "dismissed"] as const).filter(value => value !== report.status).map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label className="block text-sm">Editorial note<textarea className="form-control mt-1" value={note} onChange={event => setNote(event.target.value)} required minLength={10} maxLength={4000} /></label>
      {status === "resolved" ? <label className="block text-sm">Corrected revision ID<input className="form-control mt-1" value={revision} onChange={event => setRevision(event.target.value)} required maxLength={300} /></label> : null}
      <p className="text-xs text-(--text-muted)">Create and publish corrections through the existing independent review process, then record the corrected revision here.</p>
      {error ? <p role="alert" className="text-sm text-(--danger)">{error}</p> : null}<button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save review"}</button>
    </form>
  </article>;
}

export default function ContentCorrectionQueue() {
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [status, setStatus] = useState("open");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/workflow/reports?status=${status}`, { cache: "no-store", credentials: "same-origin" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load reports.");
      if (!Array.isArray(body.reports)) throw new Error("The report queue returned invalid data.");
      setReports(body.reports);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load reports."); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  return <section className="rounded-xl border border-(--border) bg-(--card) p-5" aria-labelledby="correction-queue-heading"><h2 id="correction-queue-heading" className="text-xl font-semibold">Content correction reports</h2><p className="mt-2 text-sm text-(--text-muted)">Reader reports across Quiz, Learn, Research, and Graph, bound to the version they saw.</p><div className="my-4 flex flex-wrap gap-3"><label className="text-sm">Filter reports<select className="form-control mt-1" value={status} onChange={event => setStatus(event.target.value)}>{["open", "in_review", "resolved", "dismissed"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><button type="button" className="btn-secondary" onClick={() => void load()}>Refresh reports</button></div>{error ? <p role="alert">{error}</p> : loading ? <p role="status">Loading reports…</p> : reports.length ? <div className="space-y-4">{reports.map(report => <ReportReview key={`${report.id}:${report.version}`} report={report} onUpdated={() => void load()} />)}</div> : <p className="text-sm">No {status.replaceAll("_", " ")} content reports.</p>}</section>;
}
