"use client";

import { useCallback, useEffect, useState } from "react";
import { getEngineUrl } from "@/lib/publicEnv";
import type { Leaderboard, LeaderboardPeriod } from "@/types/quiz";

const periods: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "This week" },
  { id: "all-time", label: "All time" },
];

export function LeaderboardPageClient() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const engineUrl = getEngineUrl();

  const load = useCallback(async () => {
    if (!engineUrl) {
      setError("The live engine is not configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${engineUrl}/leaderboard?period=${period}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Leaderboard unavailable (${response.status})`);
      const payload = await response.json() as { leaderboard?: Leaderboard } & Leaderboard;
      setLeaderboard(payload.leaderboard ?? payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Leaderboard unavailable.");
    } finally {
      setLoading(false);
    }
  }, [engineUrl, period]);

  useEffect(() => { void load(); }, [load]);

  const scorers = leaderboard?.topScorers ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Leaderboard period">
        {periods.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPeriod(item.id)}
            aria-pressed={period === item.id}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${period === item.id ? "bg-[#d4af37] text-[#17130a]" : "border border-white/12 text-[#b8ad9c] hover:border-[#d4af37]/55"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#171512] shadow-2xl" aria-live="polite">
        {loading ? (
          <div className="space-y-3 p-6" aria-label="Loading leaderboard">
            {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-white/5" />)}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="font-bold text-red-200">Could not load the leaderboard</p>
            <p className="mt-2 text-sm text-[#9f9586]">{error}</p>
            <button onClick={() => void load()} className="mt-5 rounded-xl bg-[#d4af37] px-4 py-2.5 font-bold text-[#17130a]">Retry</button>
          </div>
        ) : scorers.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-xl font-bold text-[#f7f1e7]">No ranked scores yet</p>
            <p className="mt-2 text-sm text-[#9f9586]">The next completed live round will put players on this board.</p>
          </div>
        ) : (
          <ol className="divide-y divide-white/8">
            {scorers.map((player, index) => (
              <li key={`${player.name}-${player.rank ?? index}`} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 px-5 py-4 sm:px-7">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full font-serif font-bold ${index < 3 ? "bg-[#d4af37]/15 text-[#e4c760]" : "bg-white/5 text-[#9f9586]"}`}>{player.rank ?? index + 1}</span>
                <div className="min-w-0"><p className="truncate font-bold text-[#f7f1e7]">{player.name}</p><p className="text-xs text-[#8f8474]">Ranked player</p></div>
                <p className="text-lg font-bold tabular-nums text-[#e4c760]">{player.score.toLocaleString()} <span className="text-xs font-medium text-[#8f8474]">pts</span></p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
