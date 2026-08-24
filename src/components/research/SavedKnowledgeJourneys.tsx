"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/Primitives";
import { getResearchGraphUrl } from "@/lib/publicEnv";

type Journey = {
  id: string;
  title: string;
  rootNodeId: string;
  nodeIds: string[];
  lens: string;
  visibility: "private" | "unlisted" | "public";
  shareToken: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

type Envelope = { data?: Journey[]; error?: { message?: string } };

function graphHref(base: string | null, nodeId: string) {
  if (!base) return null;
  try {
    const url = new URL("/graph", base);
    url.searchParams.set("focus", nodeId);
    return url.toString();
  } catch {
    return null;
  }
}

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Security token unavailable.");
  const body = await response.json() as { csrfToken?: string };
  if (!body.csrfToken) throw new Error("Security token unavailable.");
  return body.csrfToken;
}

export default function SavedKnowledgeJourneys() {
  const [items, setItems] = useState<Journey[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "signed_out" | "error">("loading");
  const [message, setMessage] = useState("");
  const graphUrl = useMemo(() => getResearchGraphUrl(), []);

  async function load() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/v1/learning/journeys?limit=100", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) {
        setState("signed_out");
        setItems([]);
        return;
      }
      const payload = await response.json().catch(() => ({})) as Envelope;
      if (!response.ok) throw new Error(payload.error?.message || `Request failed (${response.status}).`);
      setItems(Array.isArray(payload.data) ? payload.data : []);
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Saved journeys are unavailable.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function remove(journey: Journey) {
    if (!window.confirm(`Delete “${journey.title}”?`)) return;
    try {
      const csrf = await csrfToken();
      const response = await fetch(`/api/v1/learning/journeys/${encodeURIComponent(journey.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrf },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(payload.error?.message || "Journey could not be deleted.");
      }
      setItems((current) => current.filter((item) => item.id !== journey.id));
      setMessage("Journey deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Journey could not be deleted.");
    }
  }

  async function copyShare(journey: Journey) {
    if (journey.visibility === "private") {
      setMessage("Private journeys do not have a public share link. Save the journey as unlisted from the research mode if you want to share it.");
      return;
    }
    const href = `${window.location.origin}/research/journeys/${encodeURIComponent(journey.shareToken)}`;
    await navigator.clipboard?.writeText(href);
    setMessage("Share link copied.");
  }

  if (state === "loading") return <div className="surface-card p-6"><p className="text-sm text-(--text-muted)">Loading saved journeys…</p></div>;
  if (state === "signed_out") return <div className="surface-card p-6"><StatusBadge>Account required</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Sign in to store canonical research journeys across devices.</p><Link className="btn-primary mt-4 inline-flex" href="/login?next=/research/journeys">Sign in</Link></div>;
  if (state === "error") return <div className="surface-card p-6"><StatusBadge tone="danger">Saved journeys unavailable</StatusBadge><p className="mt-3 text-sm text-(--text-muted)">{message}</p><button className="btn-secondary mt-4" type="button" onClick={() => void load()}>Try again</button></div>;

  return (
    <div>
      {message ? <p className="mb-4 text-sm text-(--text-muted)" role="status">{message}</p> : null}
      {!items.length ? <div className="surface-card p-6"><StatusBadge>No saved journeys yet</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Save a Timeline, Compare, or Debate route and it will appear here. The stored record keeps canonical IDs and navigation metadata, not a copied theology database.</p></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((journey) => {
            const galaxy = graphHref(graphUrl, journey.rootNodeId);
            return <article key={journey.id} className="surface-card p-5">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge tone="info">{journey.lens}</StatusBadge><StatusBadge>{journey.visibility}</StatusBadge><StatusBadge tone="success">{journey.nodeIds.length} nodes</StatusBadge></div>
              <h2 className="editorial-heading mt-3 text-2xl font-semibold">{journey.title}</h2>
              <p className="mt-2 break-all font-mono text-xs text-(--text-muted)">{journey.rootNodeId}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {galaxy ? <a className="btn-primary px-3 py-2 text-sm" href={galaxy} target="_blank" rel="noopener noreferrer">Open root in Galaxy ↗</a> : null}
                {journey.visibility !== "private" ? <Link className="btn-secondary px-3 py-2 text-sm" href={`/research/journeys/${encodeURIComponent(journey.shareToken)}`}>Open share view</Link> : null}
                <button className="btn-quiet px-3 py-2 text-sm" type="button" onClick={() => void copyShare(journey)}>Copy share link</button>
                <button className="btn-quiet px-3 py-2 text-sm text-(--danger)" type="button" onClick={() => void remove(journey)}>Delete</button>
              </div>
            </article>;
          })}
        </div>
      )}
    </div>
  );
}
