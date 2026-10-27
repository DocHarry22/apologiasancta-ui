"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Primitives";
import { AppIcon } from "@/components/native/AppIcon";
import study from "@/components/native/StudyUI.module.css";
import styles from "./Leaderboard.module.css";
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
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => { try { setPlayerName(localStorage.getItem(USERNAME_STORAGE_KEY)); } catch { setPlayerName(null); } }, []);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (!engineUrl) { setError("Live rankings are temporarily unavailable."); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${engineUrl}/leaderboard?period=${period}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Leaderboard unavailable (${response.status})`);
      const payload = await response.json() as { leaderboard?: Leaderboard } & Leaderboard;
      if (!controller.signal.aborted) setLeaderboard(payload.leaderboard ?? payload);
    } catch (loadError) { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Leaderboard unavailable."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [engineUrl, period]);

  useEffect(() => { void load(); return () => requestRef.current?.abort(); }, [load]);

  const rows = useMemo(() => view === "scores"
    ? (leaderboard?.topScorers ?? []).map((player) => ({ rank: player.rank, name: player.name, value: player.score, suffix: "pts" }))
    : (leaderboard?.topStreaks ?? []).map((player) => ({ rank: player.rank, name: player.name, value: player.streak, suffix: player.streak === 1 ? "answer" : "answers" })), [leaderboard, view]);
  const possibleNameMatch = playerName ? rows.find((row) => row.name.toLowerCase() === playerName.toLowerCase()) : null;

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.periods} role="group" aria-label="Leaderboard period">
          {periods.map((item) => <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}
        </div>
        <div className={styles.views} role="group" aria-label="Leaderboard view">
          {(["scores", "streaks"] as const).map((item) => <button key={item} type="button" aria-pressed={view === item} onClick={() => setView(item)}><AppIcon name={item === "scores" ? "trophy" : "spark"} width={16} height={16} />{item === "scores" ? "Scores" : "Streaks"}</button>)}
        </div>
      </div>

      <div className={styles.heading}><h2>{period === "daily" ? "Daily leaders" : period === "weekly" ? "Weekly leaders" : "All-time leaders"}</h2><button type="button" onClick={() => void load()} disabled={loading}><AppIcon name="signal" width={15} height={15} /> Refresh</button></div>
      <section aria-label="Rankings" aria-live="polite" aria-busy={loading}>
        {loading ? <div className={styles.loading} aria-label="Loading leaderboard">{[0,1,2,3,4].map((item) => <Skeleton key={item} className="h-20 w-full rounded-xl" />)}</div>
        : error ? <div className={study.empty}><AppIcon name="trophy" /><h2>Could not load the leaderboard</h2><p>{error}</p><button type="button" onClick={() => void load()} className={study.textLink}>Retry <AppIcon name="arrow" width={16} height={16} /></button></div>
        : rows.length === 0 ? <div className={study.empty}><AppIcon name="trophy" /><h2>No {view} yet</h2><p>A completed live round will add results to this ranking.</p><Link href="/mobile" className={study.textLink}>Join a live room <AppIcon name="arrow" width={16} height={16} /></Link></div>
        : <ol className={styles.rankings}>{rows.map((row) => <li key={`${row.rank}-${row.name}`} className={`${styles.row} ${row.rank === 1 ? styles.leader : ""}`}><span className={styles.rank}>{row.rank}</span><span className={styles.avatar} aria-hidden="true">{row.name.trim().split(/\s+/).map((part) => Array.from(part)[0]).slice(0, 2).join("").toUpperCase()}</span><div className={styles.name}>{row.name}<small>{row.rank === 1 ? "Leading the way" : row.rank <= 3 ? "Among the leaders" : "Growing with every question"}</small></div><div className={styles.value}><strong>{row.value.toLocaleString()}</strong><small>{row.suffix}</small></div></li>)}</ol>}
      </section>
      {playerName ? <details className={styles.identity}><summary>Your saved quiz name</summary><div><strong>{playerName}</strong><p>Saved on this device. {possibleNameMatch && !loading && !error ? `A matching name appears at #${possibleNameMatch.rank}. ` : ""}Public rankings show display names, so a name match alone does not confirm your identity.</p></div></details> : null}
      <p className={styles.note}>Rankings reflect accepted live quiz answers for the selected period.</p>
    </>
  );
}
