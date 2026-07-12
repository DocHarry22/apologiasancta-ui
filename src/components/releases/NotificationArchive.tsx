"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReleaseNotification, ReleasePage } from "@/types/releases";

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)as_csrf_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export function NotificationArchive() {
  const [data, setData] = useState<ReleasePage | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setQuery(search.trim()); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (query) params.set("search", query);
      const response = await fetch(`/api/admin/releases?${params}`, { credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications");
    } finally { setLoading(false); }
  }, [page, query]);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (item: ReleaseNotification, read: boolean) => {
    const response = await fetch(`/api/admin/releases/${item.id}/read`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify({ read }),
    });
    if (response.ok) await load();
  };

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 border-b border-(--border) pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent)">Release centre</p>
          <h1 className="mt-1 text-2xl font-bold">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm text-(--text-secondary)">A permanent audit trail of changes shipped across the Apologia Sancta UI, engine, and research graph.</p>
        </div>
        <label className="w-full sm:max-w-sm">
          <span className="sr-only">Search release notifications</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, category, repository or commit…" className="w-full rounded-xl border border-(--border) bg-(--card) px-4 py-2.5 text-sm outline-none focus:border-(--accent)" />
        </label>
      </div>

      {error && <div role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}
      {loading && <p className="py-12 text-center text-sm text-(--muted)">Loading release notifications…</p>}
      {!loading && data?.items.length === 0 && <p className="py-12 text-center text-sm text-(--muted)">No release notifications found.</p>}

      <div className="mt-5 space-y-4">
        {data?.items.map((item) => (
          <article key={item.id} className={`rounded-2xl border p-4 sm:p-5 ${item.read ? "border-(--border) bg-(--card)" : "border-(--accent)/45 bg-(--accent)/5"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {!item.read && <span className="rounded-full bg-(--accent) px-2 py-0.5 font-semibold text-black">Unread</span>}
                  <span className="rounded-full border border-(--border) px-2 py-0.5">{item.repository}</span>
                  <span className="text-(--muted)">{item.category}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-(--text-secondary)">{item.summary}</p>
              </div>
              <button type="button" onClick={() => void markRead(item, !item.read)} className="shrink-0 rounded-lg border border-(--border) px-3 py-2 text-xs hover:border-(--accent) hover:text-(--accent)">{item.read ? "Mark unread" : "Mark read"}</button>
            </div>
            {[...item.features, ...item.fixes, ...item.changes].length > 0 && (
              <ul className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                {[...item.features, ...item.fixes, ...item.changes].map((entry) => <li key={entry} className="flex gap-2"><span className="text-(--accent)">✦</span><span>{entry}</span></li>)}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-(--border) pt-3 text-xs text-(--muted)">
              <span>{new Date(item.createdAt).toLocaleString()}</span>
              <span>Commit {item.commitSha.slice(0, 12)}</span>
              <span>Deploy: {item.deploymentStatus}</span>
              <span>Email: {item.email.status}</span>
            </div>
          </article>
        ))}
      </div>

      {data && data.pages > 1 && (
        <nav aria-label="Notification pages" className="mt-6 flex items-center justify-between">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-(--border) px-4 py-2 text-sm disabled:opacity-40">Previous</button>
          <span className="text-sm text-(--muted)">Page {data.page} of {data.pages}</span>
          <button type="button" disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-(--border) px-4 py-2 text-sm disabled:opacity-40">Next</button>
        </nav>
      )}
    </main>
  );
}
