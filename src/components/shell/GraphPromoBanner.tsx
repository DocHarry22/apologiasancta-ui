"use client";

import { useEffect, useState } from "react";
import { getResearchGraphUrl } from "@/lib/publicEnv";

const STORAGE_KEY = "apologia-graph-promo-dismissed-at";
const HIDE_FOR_MS = 14 * 24 * 60 * 60 * 1000;

function GraphIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="4" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" />
      <path d="m11 6-5 10m7-10 5 10M7 18h10" />
    </svg>
  );
}

export function GraphPromoBanner() {
  const [visible, setVisible] = useState(false);
  const graphUrl = getResearchGraphUrl();

  useEffect(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(STORAGE_KEY) || 0);
      setVisible(!dismissedAt || Date.now() - dismissedAt > HIDE_FOR_MS);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible || !graphUrl) return null;

  return (
    <aside className="border-b border-(--border) bg-(--navy) text-white" aria-label="Apologia Graph announcement">
      <div className="page-container flex min-h-9 items-center gap-2 py-1.5 text-xs sm:text-[0.8rem]">
        <span className="shrink-0 text-(--gold)"><GraphIcon /></span>
        <p className="min-w-0 flex-1 leading-5">
          <span className="font-bold">Explore Apologia Graph</span>
          <span className="hidden sm:inline"> — Browse its current Catholic topic and source-reference catalogue.</span>
        </p>
        <a className="shrink-0 font-bold text-(--gold) underline-offset-4 hover:underline" href={graphUrl} target="_blank" rel="noopener noreferrer">
          Open Graph <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
        </a>
        <button
          type="button"
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss Apologia Graph announcement"
          onClick={() => {
            try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* dismissal still works for this view */ }
            setVisible(false);
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </aside>
  );
}
