"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LeaderboardPeriod, LeaderboardScope, ScorerWithChange, StreakerWithChange } from "@/types/quiz";
import type { LeaderboardMode } from "./LeaderboardColumn";
import { getLeaderboardMode, getLeaderboardTab, type LeaderboardDrawerTab } from "@/lib/mobileUx";

type DrawerTab = LeaderboardDrawerTab;

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
  lastUpdatedMs?: number | null;
  onRefresh?: () => void;
}

const TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: "room", label: "Room" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "global", label: "Global" },
  { id: "streaks", label: "Streaks" },
];

const FOCUSABLE_SELECTOR = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

function RankMedal({ rank }: { rank: number }) {
  const medalClass =
    rank === 1
      ? "border border-(--gold) bg-(--gold) text-(--button-primary-text)"
      : rank === 2
        ? "border border-(--border) bg-(--chart-track) text-(--text)"
        : rank === 3
          ? "border border-(--warning) bg-(--surface-elevated) text-(--warning)"
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
          <div className="flex items-center justify-end gap-1 text-(--gold-hover)">
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
  lastUpdatedMs = null,
  onRefresh,
}: MobileLeaderboardDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(() => getLeaderboardTab(selectedMode));
  const prefersReducedMotion = useReducedMotion();
  const onCloseRef = useRef(onClose);
  const drawerRef = useRef<HTMLElement>(null);
  const title = scope === "global" ? "Global Ranking" : roomName || "Global Room";

  const visibleScores = useMemo(() => scorers.slice(0, 10), [scorers]);
  const lastUpdatedLabel = lastUpdatedMs ? new Date(lastUpdatedMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "not yet";

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) setActiveTab(getLeaderboardTab(selectedMode));
  }, [open, selectedMode]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      const first = drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? drawerRef.current)?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])];
      if (!focusable.length) { event.preventDefault(); drawerRef.current?.focus(); return; }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  const handleTab = (tab: DrawerTab) => {
    setActiveTab(tab);
    const mode = getLeaderboardMode(tab);
    if (mode) onModeChange(mode);
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
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-leaderboard-title"
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-hidden rounded-t-[2rem] border border-(--mobile-border) bg-(--mobile-panel-solid) shadow-[0_-24px_70px_var(--mobile-shadow)]"
            initial={prefersReducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0.8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0.8 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
          >
            <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-(--mobile-subtle)" />
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <div className="min-w-0">
                <h2 id="mobile-leaderboard-title" className="truncate text-xl font-semibold tracking-wide text-(--mobile-text)">
                  Trophy Leaderboard
                </h2>
                <p className="mt-1 truncate text-xs font-medium uppercase tracking-[0.16em] text-(--gold-hover)">
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
              <div role="tablist" aria-label="Leaderboard views" className="grid grid-cols-5 overflow-hidden rounded-xl border border-(--mobile-border) bg-(--mobile-elevated)">
                {TABS.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handleTab(tab.id)}
                      className={`min-h-11 border-r border-(--mobile-border) px-1 text-xs font-semibold last:border-r-0 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-(--accent) ${
                        active ? "bg-(--button-primary-bg) text-(--button-primary-text)" : "text-(--mobile-muted)"
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
                <div className="mb-3 rounded-xl border border-(--danger) bg-(--wrong-bg) px-3 py-2 text-sm text-(--wrong)" role="alert">{error}</div>
              ) : null}
              {loading ? (
                <div className="mb-3 rounded-xl border border-(--mobile-border) bg-(--mobile-elevated) px-3 py-2 text-sm text-(--mobile-muted)">Updating leaderboard...</div>
              ) : null}

              {activeTab !== "streaks" ? (
                <ScoreRows scorers={visibleScores} />
              ) : (
                <StreakRows streakers={streakers} />
              )}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-(--gold-hover)">
                <span>Last updated: {lastUpdatedLabel}</span>
                {onRefresh ? (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="rounded-full border border-(--mobile-border) px-3 py-1 text-(--mobile-muted)"
                  >
                    Refresh
                  </button>
                ) : null}
              </div>
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
