"use client";

import { useMemo, useState } from "react";

type Props = {
  title: string;
  rootNodeId: string;
  nodeIds: string[];
  lens?: string;
  metadata?: Record<string, unknown>;
};

type SavedJourney = {
  id?: string;
  shareToken?: string;
  visibility?: "private" | "unlisted" | "public";
};

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sign in to save this journey to your account.");
    throw new Error("Security token unavailable.");
  }
  const body = await response.json() as { csrfToken?: string };
  if (!body.csrfToken) throw new Error("Security token unavailable.");
  return body.csrfToken;
}

export default function SaveKnowledgeJourneyButton({ title, rootNodeId, nodeIds, lens = "catholic", metadata = {} }: Props) {
  const [visibility, setVisibility] = useState<"private" | "unlisted">("private");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<SavedJourney | null>(null);
  const uniqueNodes = useMemo(() => [...new Set(nodeIds.filter(Boolean))].slice(0, 120), [nodeIds]);

  async function save() {
    setState("saving");
    setMessage("");
    try {
      const csrf = await csrfToken();
      const response = await fetch("/api/v1/learning/journeys", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ title, rootNodeId, nodeIds: uniqueNodes, lens, visibility, metadata }),
      });
      const payload = await response.json().catch(() => ({})) as { data?: SavedJourney; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || `Save failed (${response.status}).`);
      setSaved(payload.data || null);
      setState("saved");
      setMessage(visibility === "private" ? "Journey saved privately." : "Journey saved with an unlisted share link.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Journey could not be saved.");
    }
  }

  const shareHref = saved?.shareToken && saved.visibility !== "private"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/research/journeys/${encodeURIComponent(saved.shareToken)}`
    : "";

  async function copyShareLink() {
    if (!shareHref) return;
    await navigator.clipboard?.writeText(shareHref);
    setMessage("Share link copied.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="min-h-10 rounded-lg border border-(--border) bg-(--surface) px-3 text-sm"
        value={visibility}
        onChange={(event) => { setVisibility(event.target.value as "private" | "unlisted"); setSaved(null); setState("idle"); setMessage(""); }}
        aria-label="Saved journey visibility"
      >
        <option value="private">Private</option>
        <option value="unlisted">Unlisted share link</option>
      </select>
      <button type="button" className="btn-secondary" onClick={save} disabled={state === "saving" || uniqueNodes.length === 0}>
        {state === "saving" ? "Saving…" : "Save journey"}
      </button>
      {shareHref ? <button type="button" className="btn-quiet" onClick={copyShareLink}>Copy share link</button> : null}
      {message ? <span className={`text-sm ${state === "error" ? "text-(--danger)" : "text-(--text-muted)"}`} role="status">{message}</span> : null}
    </div>
  );
}
