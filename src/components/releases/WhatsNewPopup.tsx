"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { getEngineUrl } from "@/lib/publicEnv";
import type { ReleaseNotification } from "@/types/releases";

const SEEN_KEY = "apologia-seen-release";
export const SHOW_WHATS_NEW_EVENT = "apologia:show-whats-new";

export function WhatsNewPopup() {
  const [release, setRelease] = useState<ReleaseNotification | null>(null);
  const latestReleaseRef = useRef<ReleaseNotification | null>(null);

  useEffect(() => {
    const engineUrl = getEngineUrl();
    if (!engineUrl) return;
    const controller = new AbortController();
    const loadLatest = (forceOpen = false) => fetch(`${engineUrl}/releases/latest`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { release?: ReleaseNotification | null }) => {
        const latest = payload.release;
        latestReleaseRef.current = latest ?? null;
        if (latest && (forceOpen || window.localStorage.getItem(SEEN_KEY) !== `${latest.repository}:${latest.commitSha}`)) {
          setRelease(latest);
        }
      })
      .catch(() => undefined);
    void loadLatest();
    const showLatest = () => {
      if (latestReleaseRef.current) {
        setRelease(latestReleaseRef.current);
      } else {
        void loadLatest(true);
      }
    };
    window.addEventListener(SHOW_WHATS_NEW_EVENT, showLatest);
    return () => {
      controller.abort();
      window.removeEventListener(SHOW_WHATS_NEW_EVENT, showLatest);
    };
  }, []);

  const dismiss = () => {
    if (release) window.localStorage.setItem(SEEN_KEY, `${release.repository}:${release.commitSha}`);
    setRelease(null);
  };

  if (!release) return null;

  const highlights = [...release.features, ...release.fixes, ...release.changes].slice(0, 6);
  return (
    <Dialog titleId="whats-new-title" onClose={dismiss} className="max-w-xl rounded-2xl p-5 text-(--text) sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent)">What’s new</p>
            <h2 id="whats-new-title" className="mt-2 text-xl font-bold sm:text-2xl">{release.title}</h2>
            <p className="mt-1 text-xs text-(--muted)">{release.repository} · {new Date(release.createdAt).toLocaleDateString()}</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Dismiss update" className="btn-quiet min-h-10 px-3 py-1.5 text-sm">Close</button>
        </div>
        <p className="mt-4 text-sm leading-6 text-(--text-secondary)">{release.summary}</p>
        {highlights.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {highlights.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-(--accent)">✦</span><span>{item}</span></li>)}
          </ul>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={dismiss} className="btn-primary">Got it</button>
        </div>
    </Dialog>
  );
}
