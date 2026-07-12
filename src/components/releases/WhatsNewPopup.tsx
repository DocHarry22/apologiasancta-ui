"use client";

import { useEffect, useRef, useState } from "react";
import { getEngineUrl } from "@/lib/publicEnv";
import type { ReleaseNotification } from "@/types/releases";

const SEEN_KEY = "apologia-seen-release";

export function WhatsNewPopup() {
  const [release, setRelease] = useState<ReleaseNotification | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const engineUrl = getEngineUrl();
    if (!engineUrl) return;
    const controller = new AbortController();
    fetch(`${engineUrl}/releases/latest`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { release?: ReleaseNotification | null }) => {
        const latest = payload.release;
        if (latest && window.localStorage.getItem(SEEN_KEY) !== `${latest.repository}:${latest.commitSha}`) {
          setRelease(latest);
          window.setTimeout(() => closeRef.current?.focus(), 0);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const dismiss = () => {
    if (release) window.localStorage.setItem(SEEN_KEY, `${release.repository}:${release.commitSha}`);
    setRelease(null);
  };

  if (!release) return null;

  const highlights = [...release.features, ...release.fixes, ...release.changes].slice(0, 6);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="w-full max-w-xl rounded-2xl border border-(--accent)/40 bg-(--card) p-5 text-(--text) shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent)">What’s new</p>
            <h2 id="whats-new-title" className="mt-2 text-xl font-bold sm:text-2xl">{release.title}</h2>
            <p className="mt-1 text-xs text-(--muted)">{release.repository} · {new Date(release.createdAt).toLocaleDateString()}</p>
          </div>
          <button ref={closeRef} type="button" onClick={dismiss} aria-label="Dismiss update" className="rounded-full border border-(--border) px-3 py-1.5 text-sm hover:border-(--accent) hover:text-(--accent)">Close</button>
        </div>
        <p className="mt-4 text-sm leading-6 text-(--text-secondary)">{release.summary}</p>
        {highlights.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {highlights.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-(--accent)">✦</span><span>{item}</span></li>)}
          </ul>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={dismiss} className="rounded-xl bg-(--accent) px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90">Got it</button>
        </div>
      </section>
    </div>
  );
}
