"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProgressBar, StatusBadge } from "@/components/ui/Primitives";
import { getResearchGraphUrl } from "@/lib/publicEnv";

type GapRecommendation = {
  nodeId: string;
  masteryPercent: number;
  evidenceAttempts: number;
  correctEvidence: number;
  lastEvidenceAt?: string | null;
  lessonId?: string | null;
  lessonSlug?: string | null;
  lessonTitle?: string | null;
  lessonKnowledgeRole?: string | null;
  reviewQuestionId?: string | null;
  reviewQuestionDifficulty?: number | null;
  recommendationType: "knowledge_gap";
  evidenceBasis: "stored_server_scored_mastery";
  unseenConceptsExcluded: true;
};

type Envelope = {
  data?: GapRecommendation[];
  meta?: {
    masteryBelow?: number;
    evidenceRequired?: boolean;
    unseenConceptsExcluded?: boolean;
  };
};

function graphNodeUrl(base: string | null, nodeId: string) {
  if (!base) return null;
  try {
    const url = new URL("/graph", base);
    url.searchParams.set("focus", nodeId);
    return url.toString();
  } catch {
    return null;
  }
}

export default function KnowledgeGapRecommendations() {
  const [items, setItems] = useState<GapRecommendation[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "signed_out" | "unavailable">("loading");
  const graphUrl = useMemo(() => getResearchGraphUrl(), []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/learning/recommendations/knowledge?limit=6&masteryBelow=80", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setState("signed_out");
          return null;
        }
        if (!response.ok) throw new Error("recommendations unavailable");
        return response.json() as Promise<Envelope>;
      })
      .then((payload) => {
        if (!payload) return;
        setItems(Array.isArray(payload.data) ? payload.data : []);
        setState("ready");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setState("unavailable");
      });
    return () => controller.abort();
  }, []);

  if (state === "loading" || state === "signed_out" || state === "unavailable" || items.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-(--border) bg-[color-mix(in_srgb,var(--gold)_5%,transparent)]" aria-labelledby="knowledge-gaps-heading">
      <div className="page-container py-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Adaptive review</p>
            <h2 id="knowledge-gaps-heading" className="editorial-heading mt-1 text-2xl font-semibold sm:text-3xl">Review concepts your assessment evidence says need work.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-(--text-muted)">Only concepts with stored, server-scored evidence appear here. Concepts you have never been assessed on remain unknown rather than being mislabeled as weak.</p>
          </div>
          <StatusBadge tone="info">Evidence-based · not inferred from clicks</StatusBadge>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const mastery = Math.max(0, Math.min(100, Number(item.masteryPercent) || 0));
            const graphHref = graphNodeUrl(graphUrl, item.nodeId);
            return (
              <article key={item.nodeId} className="surface-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-(--text-muted)">Canonical concept</p>
                    <code className="mt-1 block break-all text-xs text-(--gold-hover)">{item.nodeId}</code>
                  </div>
                  <StatusBadge tone={mastery < 50 ? "warning" : "neutral"}>{Math.round(mastery)}%</StatusBadge>
                </div>
                <div className="mt-4"><ProgressBar value={mastery} label={`${item.nodeId} mastery`} /></div>
                <p className="mt-3 text-sm leading-6 text-(--text-muted)">{item.correctEvidence} correct across {item.evidenceAttempts} stored assessment evidence item{item.evidenceAttempts === 1 ? "" : "s"}.</p>
                {item.lessonTitle && item.lessonSlug ? <p className="mt-3 text-sm"><span className="text-(--text-muted)">Mapped review lesson:</span> <strong>{item.lessonTitle}</strong></p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.lessonSlug ? <Link className="btn-primary px-3 py-2 text-sm" href={`/learn/${encodeURIComponent(item.lessonSlug)}`}>Review lesson</Link> : null}
                  {graphHref ? <a className="btn-secondary px-3 py-2 text-sm" href={graphHref} target="_blank" rel="noopener noreferrer">Explore concept ↗</a> : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
