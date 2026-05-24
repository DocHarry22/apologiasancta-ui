"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LeaderboardPeriod, LeaderboardScope, ScorerWithChange, StreakerWithChange } from "@/types/quiz";
import type { LeaderboardMode } from "./LeaderboardColumn";

type DrawerTab = "global" | "room" | "scores" | "streaks";

interface MobileLeaderboardDrawerProps {
  open: boolean;
  onClose: () => void;
  scorers: ScorerWithChange[];
  streakers: StreakerWithChange[];
  roomName?: string;
  scope?: LeaderboardScope;
  period?: LeaderboardPeriod;
  selectedMode: LeaderboardMode;
  onModeChange: (mode: LeaderboardMode) => void;
  loading?: boolean;
  error?: string | null;
}

const TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: "global", label: "Global" },
  { id: "room", label: "Room" },
  { id: "scores", label: "Scores" },
  { id: "streaks", label: "Streaks" },
];

function tabForMode(mode: LeaderboardMode): DrawerTab {
  if (mode === "global-all-time") return "global";
  if (mode === "room-daily") return "room";
  return "scores";
}

function RankMedal({ rank }: { rank: number }) {
  const medalClass =
    rank === 1
      ? "bg-linear-to-br from-[#ffe58a] to-[#c79519] text-white"
      : rank === 2
        ? "bg-linear-to-br from-[#f1f3f5] to-[#8c9299] text-white"
        : rank === 3
          ? "bg-linear-to-br from-[#e8b06b] to-[#935a1d] text-white"
      : "bg-(--mobile-elevated) text-(--mobile-muted)";

  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums shadow-sm ${medalClass}`}>
      {rank}
    </span>
  );
}

function ScoreRows({ scorers }: { scorers: ScorerWithChange[] }) {
  if (scorers.length === 0) {
    return <div className="rounded-xl border border-dashed border-(--border) p-6 text-center text-sm text-(--muted)">No scores yet</div>;
  }

  return (
    <div className="rounded-xl border border-(--mobile-border) bg-(--mobile-elevated)">
      {scorers.slice(0, 10).map((scorer, index) => (
        <div
          key={`${scorer.rank}-${scorer.name}`}
          className={`grid grid-cols-[2.5rem_minmax(0,1fr)_4.25rem_3.75rem] items-center gap-2 px-3 py-2.5 ${
            index > 0 ? "border-t border-(--mobile-border)" : ""
          }`}
        >
          <RankMedal rank={scorer.rank} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-(--mobile-text)">{scorer.name}</div>
            {scorer.rankDelta && scorer.rankDelta > 0 ? (
              <div className="text-[10px] font-semibold text-(--correct)">+{scorer.rankDelta} places</div>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-(--mobile-subtle)">Score</div>
            <div className="text-base font-bold tabular-nums text-(--mobile-text)">{scorer.score}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-(--mobile-subtle)">Rank</div>
            <div className="text-base font-bold tabular-nums text-(--mobile-text)">#{scorer.rank}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StreakRows({ streakers }: { streakers: StreakerWithChange[] }) {
  if (streakers.length === 0) {
    return <div className="rounded-xl border border-dashed border-(--border) p-6 text-center text-sm text-(--muted)">No streaks yet</div>;
  }

  return (
    <div className="rounded-xl border border-(--mobile-border) bg-(--mobile-elevated)">
      {streakers.slice(0, 8).map((streaker, index) => (
        <div
          key={`${streaker.rank}-${streaker.name}`}
          className={`grid grid-cols-[2.5rem_minmax(0,1fr)_4.75rem] items-center gap-2 px-3 py-2.5 ${
            index > 0 ? "border-t border-(--mobile-border)" : ""
          }`}
        >
          <RankMedal rank={streaker.rank} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-(--mobile-text)">{streaker.name}</div>
            {streaker.rankDelta && streaker.rankDelta > 0 ? (
              <div className="text-[10px] font-semibold text-(--correct)">+{streaker.rankDelta} places</div>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-1 text-[#c99113]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className="text-base font-bold tabular-nums">{streaker.streak}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MobileLeaderboardDrawer({
  open,
  onClose,
  scorers,
  streakers,
  roomName,
  scope = "room",
  period = "all-time",
  selectedMode,
  onModeChange,
  loading = false,
  error = null,
}: MobileLeaderboardDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(() => tabForMode(selectedMode));
  const prefersReducedMotion = useReducedMotion();
  const title = scope === "global" ? "Global Ranking" : roomName || "Global Room";

  const visibleScores = useMemo(() => scorers.slice(0, activeTab === "global" || activeTab === "room" ? 5 : 10), [activeTab, scorers]);

  const handleTab = (tab: DrawerTab) => {
    setActiveTab(tab);
    if (tab === "global") {
      onModeChange("global-all-time");
    } else if (tab === "room") {
      onModeChange("room-daily");
    } else if (tab === "scores") {
      onModeChange("room-all-time");
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.button
            type="button"
            aria-label="Close leaderboard"
            className="absolute inset-0 bg-(--mobile-backdrop) backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Leaderboard"
            className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-hidden rounded-t-[2rem] border border-(--mobile-border) bg-(--mobile-panel-solid) shadow-[0_-24px_70px_var(--mobile-shadow)]"
            initial={prefersReducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0.8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0.8 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
          >
            <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-(--mobile-subtle)" />
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold tracking-wide text-(--mobile-text)">
                  Trophy Leaderboard
                </h2>
                <p className="mt-1 truncate text-xs font-medium uppercase tracking-[0.16em] text-[#9c7a2f]">
                  {title} - {period.replace("-", " ")}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-(--mobile-border) text-(--mobile-muted)"
                aria-label="Close leaderboard"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5">
              <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-(--mobile-border) bg-(--mobile-elevated)">
                {TABS.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTab(tab.id)}
                      className={`min-h-11 border-r border-(--mobile-border) px-2 text-sm font-semibold last:border-r-0 ${
                        active ? "bg-linear-to-r from-[#d9a51c] to-[#b98512] text-white" : "text-(--mobile-muted)"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 max-h-[52vh] overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {error ? (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              ) : null}
              {loading ? (
                <div className="mb-3 rounded-xl border border-(--mobile-border) bg-(--mobile-elevated) px-3 py-2 text-sm text-(--mobile-muted)">Updating leaderboard...</div>
              ) : null}

              {(activeTab === "global" || activeTab === "room" || activeTab === "scores") ? (
                <ScoreRows scorers={activeTab === "scores" ? scorers : visibleScores} />
              ) : (
                <StreakRows streakers={streakers} />
              )}

              <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-[#b98512]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                Updates in real time
              </div>
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
