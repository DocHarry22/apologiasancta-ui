"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/ui/Dialog";
import { displayedRevision, reportReasons, type ReportReason, type ReportTarget } from "@/lib/contentReports";
import styles from "@/components/native/ScreenSurface.module.css";

export const PENDING_REPORT_KEY = "apologia-pending-content-report";

export function IssueReportForm({ target, sourceUrl, onClose, initialReason, initialDetails }: { target: ReportTarget; sourceUrl: string; onClose?: () => void; initialReason?: ReportReason; initialDetails?: string }) {
  const id = useId();
  const [reason, setReason] = useState<ReportReason>(initialReason || (target.contentType === "question" ? "incorrect_answer" : "unclear_wording"));
  const [details, setDetails] = useState(initialDetails || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signIn, setSignIn] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; revisionId: string } | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true); setError(""); setSignIn(false);
    try {
      const csrf = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      if (csrf.status === 401) {
        try { sessionStorage.setItem(PENDING_REPORT_KEY, JSON.stringify({ target, sourceUrl, reason, details })); } catch { /* The form remains open if browser storage is unavailable. */ }
        setSignIn(true);
        throw new Error("Sign in to send this report to the editorial team.");
      }
      const security = await csrf.json();
      if (!csrf.ok || !security.csrfToken) throw new Error("Security token unavailable. Please try again.");
      const response = await fetch("/api/content-reports", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": security.csrfToken },
        body: JSON.stringify({ target, sourceUrl, reason, details }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The report could not be sent. Please try again.");
      setReceipt(body);
      try { sessionStorage.removeItem(PENDING_REPORT_KEY); } catch { /* Receipt is already saved on the server. */ }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The report could not be sent."); }
    finally { setBusy(false); }
  }

  if (receipt) return <div className={`${styles.receipt} ${styles.content}`} role="status"><h2>Report received</h2><p>Thank you. The editorial team can review the exact version you reported.</p><details className={styles.details}><summary>Report reference</summary><p>Reference: {receipt.id}<br />Revision: {receipt.revisionId}</p></details>{onClose ? <button type="button" className="btn-primary mt-4" onClick={onClose}>Done</button> : null}</div>;

  return <form className={`${styles.reportForm} ${styles.content}`} onSubmit={event => { event.preventDefault(); void submit(); }}>
    <p className="text-sm font-semibold">{target.title}</p>
    <p className="text-(--text-muted)">This report includes the displayed {target.contentType} and its version.</p>{target.revisionId ? <details className={styles.details}><summary>Content version</summary><p>Revision: {target.revisionId}</p></details> : null}
    <label className="block text-sm font-semibold" htmlFor={`${id}-reason`}>Reason<select id={`${id}-reason`} className="form-control mt-2" value={reason} onChange={event => setReason(event.target.value as ReportReason)}>{Object.entries(reportReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="block text-sm font-semibold" htmlFor={`${id}-details`}>Details {reason === "other" ? "(required)" : "(optional)"}<textarea id={`${id}-details`} className="form-control mt-2 min-h-28" maxLength={4000} minLength={reason === "other" ? 10 : undefined} required={reason === "other"} value={details} onChange={event => setDetails(event.target.value)} placeholder="Tell us what needs correcting. Include the citation or wording if helpful." /></label>
    {error ? <p role="alert" className="text-sm text-(--danger)">{error}</p> : null}
    {signIn ? <a className="btn-secondary inline-flex" href="/login?next=%2Freport-issue">Sign in to report</a> : null}
    <div className="flex flex-wrap gap-3"><button type="submit" className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send report"}</button>{onClose ? <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Cancel</button> : null}</div>
  </form>;
}

export function ReportIssue({ app, contentType, contentId, title, snapshot, revisionId }: ReportTarget) {
  const titleId = useId();
  const [frozen, setFrozen] = useState<{ target: ReportTarget; sourceUrl: string } | null>(null);
  return <>
    <button type="button" aria-label={`Report an issue with ${title}`} className="my-2 min-h-11 px-2 text-sm underline underline-offset-4 text-(--text-muted) hover:text-(--gold-hover)" onClick={() => {
      setFrozen({ target: JSON.parse(JSON.stringify({ app, contentType, contentId, title: title.slice(0, 1200), snapshot, revisionId: revisionId || displayedRevision(snapshot) })), sourceUrl: window.location.pathname + window.location.search });
    }}>Report an issue</button>
    {frozen ? createPortal(<Dialog titleId={titleId} onClose={() => setFrozen(null)} className="max-h-[90dvh] max-w-xl overflow-y-auto rounded-2xl p-6"><h2 id={titleId} className="mb-4 text-2xl font-semibold">Report an issue</h2><IssueReportForm {...frozen} onClose={() => setFrozen(null)} /></Dialog>, document.body) : null}
  </>;
}
