"use client";
import { useEffect, useRef } from "react";
import type { Claim, PublishedPack } from "@/lib/agent/contracts";
export default function EvidenceDrawer({ claim, sources, onClose }: { claim: Claim; sources: PublishedPack["sources"]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="evidence-title"
    className="fixed inset-0 m-auto max-h-[90dvh] w-[min(42rem,95vw)] overflow-y-auto rounded-2xl border border-(--border) bg-(--card) p-6 text-foreground shadow-xl backdrop:bg-black/60">
    <div className="flex items-start justify-between gap-4"><h2 id="evidence-title" className="text-xl font-bold">Evidence drawer</h2><button type="button" onClick={onClose} className="btn-quiet px-3 py-2" aria-label="Close evidence drawer">Close</button></div>
    <p className="mt-4 leading-7">{claim.text}</p>
    <p className="mt-2 text-sm text-(--text-secondary)">{claim.classification.replaceAll("_", " ")} · AI-generated paraphrase</p>
    {claim.evidence.map((e, i) => { const source = sources.find(s => s.id === e.sourceId); if (!source) return null;
      return <article key={`${e.sourceId}-${i}`} className="mt-5 rounded-xl border border-(--border) p-4">
        <h3 className="font-semibold">{source.title}</h3><p className="mt-1 text-sm">{e.locator} · {source.kind}</p>
        <blockquote className="my-4 border-l-4 border-(--accent) pl-4 leading-7">“{e.quote}”</blockquote>
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-(--accent) underline">Read the original source ↗</a>
        <p className="mt-3 text-xs text-(--text-secondary)">Retrieved {new Date(source.retrievedAt).toLocaleString()} · Exact quotation checked against retrieved text.</p>
        <details className="mt-2 text-xs"><summary>Source fingerprint</summary><p className="mt-2 break-all">SHA-256: {source.sha256}</p></details>
      </article>;
    })}
    <p className="mt-5 text-sm leading-6 text-(--text-secondary)">An automated audit passed. This material has not been reviewed by a human or approved by a Church authority. Check the original passage and its context.</p>
  </dialog>;
}
