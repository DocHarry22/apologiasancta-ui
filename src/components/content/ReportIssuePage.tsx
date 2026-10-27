"use client";

import { useEffect, useState } from "react";
import { IssueReportForm, PENDING_REPORT_KEY } from "./ReportIssue";
import { reportReasons, type ReportReason, type ReportTarget } from "@/lib/contentReports";
import Link from "next/link";
import { ScreenSurface, ScreenIntro } from "@/components/native/ScreenSurface";
import styles from "@/components/native/ScreenSurface.module.css";

export default function ReportIssuePage() {
  const [pending, setPending] = useState<{ target: ReportTarget; sourceUrl: string; initialReason?: ReportReason; initialDetails?: string } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const fragment = new URLSearchParams(window.location.hash.slice(1)).get("report");
      const raw = fragment || sessionStorage.getItem(PENDING_REPORT_KEY);
      if (raw && raw.length < 160_000) {
        const value = JSON.parse(raw);
        if (value?.target?.contentId && value.target.snapshot && typeof value.target.title === "string") {
          setPending({ target: value.target, sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : "", initialReason: Object.hasOwn(reportReasons, value.reason) ? value.reason : undefined, initialDetails: typeof value.details === "string" ? value.details : undefined });
          sessionStorage.setItem(PENDING_REPORT_KEY, raw);
          // Keep public content out of subsequent referrers and browser URL copies.
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    } catch { /* Invalid handoffs show an actionable empty state. */ }
    setReady(true);
  }, []);
  return <ScreenSurface><ScreenIntro eyebrow="Help us improve" title="Report an issue" accent="Better learning, together." description="Tell the editorial team about a question, lesson, or research claim that needs another look." /><section className={styles.card}>{!ready ? <p role="status">Loading content…</p> : pending ? <IssueReportForm {...pending} /> : <><p>Open “Report an issue” on the question, lesson, or research claim you want the editorial team to review.</p><div className={styles.actions}><Link className="btn-primary" href="/learn">Explore lessons</Link><Link className="btn-secondary" href="/research">Explore research</Link></div></>}</section></ScreenSurface>;
}
