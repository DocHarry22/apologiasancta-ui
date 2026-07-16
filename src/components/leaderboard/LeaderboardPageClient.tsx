"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import { USERNAME_STORAGE_KEY } from "@/lib/playerIdentity";
import { getEngineUrl } from "@/lib/publicEnv";
import type { Leaderboard, LeaderboardPeriod } from "@/types/quiz";

const periods: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: "daily", label: "Daily" }, { id: "weekly", label: "Weekly" }, { id: "all-time", label: "All time" },
];

export function LeaderboardPageClient() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [view, setView] = useState<"scores" | "streaks">("scores");
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const engineUrl = getEngineUrl();

  useEffect(() => { try { setPlayerName(localStorage.getItem(USERNAME_STORAGE_KEY)); } catch { setPlayerName(null); } }, []);

  const load = useCallback(async () => {
    if (!engineUrl) { setError("The live Engine is not configured."); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${engineUrl}/leaderboard?period=${period}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Leaderboard unavailable (${response.status})`);
      const payload = await response.json() as { leaderboard?: Leaderboard } & Leaderboard;
      setLeaderboard(payload.leaderboard ?? payload);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Leaderboard unavailable."); }
    finally { setLoading(false); }
  }, [engineUrl, period]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => view === "scores"
    ? (leaderboard?.topScorers ?? []).map((player) => ({ rank: player.rank, name: player.name, value: player.score, suffix: "pts" }))
    : (leaderboard?.topStreaks ?? []).map((player) => ({ rank: player.rank, name: player.name, value: player.streak, suffix: player.streak === 1 ? "answer" : "answers" })), [leaderboard, view]);
  const possibleNameMatch = playerName ? rows.find((row) => row.name.toLowerCase() === playerName.toLowerCase()) : null;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border border-(--border) bg-(--surface) p-1" role="group" aria-label="Leaderboard period">
          {periods.map((item) => <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => setPeriod(item.id)} className={`min-h-11 rounded-md px-4 text-sm font-bold ${period === item.id ? "bg-(--gold) text-(--button-primary-text)" : "text-(--text-muted) hover:bg-(--surface-elevated)"}`}>{item.label}</button>)}
        </div>
        <div className="flex gap-1 rounded-lg border border-(--border) bg-(--surface) p-1" role="group" aria-label="Leaderboard view">
          {(["scores", "streaks"] as const).map((item) => <button key={item} type="button" aria-pressed={view === item} onClick={() => setView(item)} className={`min-h-11 flex-1 rounded-md px-4 text-sm font-bold capitalize sm:flex-none ${view === item ? "bg-(--navy) text-white" : "text-(--text-muted) hover:bg-(--surface-elevated)"}`}>{item}</button>)}
        </div>
      </div>

      {playerName ? <section className="surface-card mt-4 flex flex-wrap items-center justify-between gap-3 p-4" aria-label="Saved quiz identity"><div><p className="eyebrow">Saved quiz identity</p><p className="mt-1 font-bold">{playerName}</p><p className="mt-1 text-xs text-(--text-muted)">Public rankings do not include stable player IDs, so a matching display name cannot be verified as yours.</p></div>{possibleNameMatch ? <div className="text-right"><strong className="editorial-heading text-2xl">Possible #{possibleNameMatch.rank}</strong><p className="text-xs text-(--text-muted)">name match only</p></div> : <StatusBadge>No matching name in this returned ranking</StatusBadge>}</section> : null}

      <section className="surface-card mt-4 overflow-hidden" aria-live="polite" aria-busy={loading}>
        {loading ? <div className="space-y-3 p-5" aria-label="Loading leaderboard">{[0,1,2,3,4].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
        : error ? <div className="p-8 text-center"><p className="font-bold text-(--danger)">Could not load the leaderboard</p><p className="mt-2 text-sm text-(--text-muted)">{error}</p><button type="button" onClick={() => void load()} className="btn-primary mt-5">Retry</button></div>
        : rows.length === 0 ? <div className="p-5"><EmptyState title={`No ${view} yet`} description="A completed live round will add real accepted results to this ranking." action={<Link href="/mobile" className="btn-primary">Join a live room</Link>} /></div>
        : <>
          <div className="hidden grid-cols-[5rem_1fr_10rem_8rem] border-b border-(--border) bg-(--surface-elevated) px-6 py-3 text-xs font-bold uppercase tracking-wider text-(--text-muted) sm:grid"><span>Rank</span><span>Player</span><span className="text-right">{view === "scores" ? "Score" : "Streak"}</span><span className="text-right">Movement</span></div>
          <ol className="divide-y divide-(--border)">{rows.map((row, index) => <li key={`${row.rank}-${row.name}`} className="grid grid-cols-[3.2rem_1fr_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[5rem_1fr_10rem_8rem] sm:px-6"><span className={`grid h-10 w-10 place-items-center rounded-full font-[family-name:var(--font-editorial)] font-bold ${index < 3 ? "border border-(--gold) text-(--gold-hover)" : "bg-(--surface-elevated) text-(--text-muted)"}`}>{row.rank}</span><span className="min-w-0"><strong className="block truncate">{row.name}</strong><span className="text-xs text-(--text-muted)">{index < 3 ? "Leading position" : "Ranked player"}</span></span><strong className="text-right font-[family-name:var(--font-editorial)] text-lg text-(--gold-hover)">{row.value.toLocaleString()} <span className="text-xs font-normal text-(--text-muted)">{row.suffix}</span></strong><span className="hidden text-right text-sm text-(--text-muted) sm:block" aria-label="Rank movement unavailable">—</span></li>)}</ol>
        </>}
      </section>
      <p className="mt-3 text-xs leading-5 text-(--text-muted)">Rank movement and positions outside the returned top list are not supplied by the current Engine API. Times use the Engine&apos;s ranking windows.</p>
    </>
  );
}
