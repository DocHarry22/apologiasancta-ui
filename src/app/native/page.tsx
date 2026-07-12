import type { Metadata } from "next";
import Link from "next/link";
import { LiveHeroBanner } from "@/components/native/LiveHeroBanner";
import { TopicsScroll } from "@/components/native/TopicsScroll";
import { VerseOfTheDay } from "@/components/native/VerseOfTheDay";
import { StreakBadge } from "@/components/native/StreakBadge";
import { StatsPanel } from "@/components/native/StatsPanel";

import { getEngineUrl } from "@/lib/publicEnv";
import topicsIndex from "@/../content/topics/index.json";

export const metadata: Metadata = {
  title: "Apologia Sancta",
  description: "Defend the Faith. Learn the Truth.",
};

const RESEARCH_URL = "https://github.com/DocHarry22/apologia-graph";

/** Top 6 topics by questionCount */
const featuredTopics = [...topicsIndex.topics]
  .sort((a, b) => b.questionCount - a.questionCount)
  .slice(0, 6);

export default function NativeHome() {
  const engineUrl = getEngineUrl() ?? "https://apologiasancta-engine.onrender.com";

  return (
    // Force dark theme for the APK home regardless of user setting
    <div
      data-theme="dark"
      className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col"
      style={{ background: "var(--mobile-bg)", color: "var(--mobile-text)" }}
    >
      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          background: "rgba(17,16,15,0.92)",
          borderBottom: "1px solid rgba(212,175,55,0.14)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Logo + wordmark */}
        <div className="flex items-center gap-2.5">
          {/* Shield SVG */}
          <svg
            width="34"
            height="38"
            viewBox="0 0 34 38"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M17 1L2 7v11c0 9.63 6.45 18.64 15 21 8.55-2.36 15-11.37 15-21V7L17 1z"
              fill="rgba(212,175,55,0.15)"
              stroke="#d4af37"
              strokeWidth="1.5"
            />
            {/* Cross on shield */}
            <line x1="17" y1="10" x2="17" y2="28" stroke="#d4af37" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="9" y1="18" x2="25" y2="18" stroke="#d4af37" strokeWidth="1.8" strokeLinecap="round" />
            {/* Crown dots */}
            <circle cx="17" cy="6" r="1.5" fill="#d4af37" />
            <circle cx="11" cy="8" r="1" fill="#d4af37" />
            <circle cx="23" cy="8" r="1" fill="#d4af37" />
          </svg>

          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-wide text-[#f4efe5]">
              Apologia Sancta
            </span>
            <span className="text-[10px] tracking-wide text-[#9c917f]">
              Defend the Faith. Learn the Truth.
            </span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Bell */}
          <button
            aria-label="Notifications"
            className="relative rounded-full p-2 text-[#c7bca8] transition-colors hover:text-[#d4af37]"
            style={{ background: "rgba(212,175,55,0.08)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Notification dot */}
            <span
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-[#11100f]"
              style={{ background: "#d4af37" }}
            />
          </button>

          {/* Streak badge */}
          <StreakBadge />

          {/* Avatar */}
          <div
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full"
            style={{
              background: "rgba(212,175,55,0.12)",
              border: "1.5px solid rgba(212,175,55,0.3)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 60 60" fill="none" aria-hidden="true">
              {/* Simple saint silhouette */}
              <circle cx="30" cy="20" r="10" fill="rgba(212,175,55,0.35)" />
              <ellipse cx="30" cy="48" rx="18" ry="14" fill="rgba(212,175,55,0.25)" />
              {/* Halo */}
              <circle cx="30" cy="17" r="13" stroke="#d4af37" strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
            </svg>
          </div>
        </div>
      </header>

      {/* ── SCROLLABLE BODY ─────────────────────────────────────── */}
      <main className="flex flex-1 flex-col gap-6 pb-24 pt-2">

        {/* Hero Banner */}
        <LiveHeroBanner engineUrl={engineUrl} />

        {/* ── FEATURE CARDS ─────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 px-4">
          {/* Resources */}
          <Link
            href="/library"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 transition-opacity hover:opacity-90 active:opacity-70"
            style={{
              background: "linear-gradient(145deg, #f5f0e8 0%, #e8dfc8 100%)",
              minHeight: "150px",
            }}
          >
            {/* Background arch sketch */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-full w-3/5 opacity-15"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 100'%3E%3Cellipse cx='80' cy='50' rx='60' ry='80' fill='none' stroke='%23614e2a' stroke-width='0.8'/%3E%3Cellipse cx='80' cy='50' rx='40' ry='55' fill='none' stroke='%23614e2a' stroke-width='0.6'/%3E%3C/svg%3E\")",
                backgroundSize: "cover",
              }}
            />

            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: "rgba(97,78,42,0.15)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#614e2a" strokeWidth="1.8" className="h-5 w-5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div>
              <h3 className="text-base font-bold text-[#2a1f0e]">Resources</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-[#614e2a]">
                Articles, notes, and study material.
              </p>
            </div>

            <div
              className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full"
              style={{ background: "#c9a227" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Research Graph */}
          <a
            href={RESEARCH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 transition-opacity hover:opacity-90 active:opacity-70"
            style={{
              background: "linear-gradient(145deg, #f5f0e8 0%, #e8dfc8 100%)",
              minHeight: "150px",
            }}
          >
            {/* Background network sketch */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-full w-3/5 opacity-15"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='20' cy='20' r='4' fill='none' stroke='%23614e2a' stroke-width='0.8'/%3E%3Ccircle cx='60' cy='20' r='4' fill='none' stroke='%23614e2a' stroke-width='0.8'/%3E%3Ccircle cx='40' cy='55' r='4' fill='none' stroke='%23614e2a' stroke-width='0.8'/%3E%3Cline x1='20' y1='20' x2='60' y2='20' stroke='%23614e2a' stroke-width='0.6'/%3E%3Cline x1='20' y1='20' x2='40' y2='55' stroke='%23614e2a' stroke-width='0.6'/%3E%3Cline x1='60' y1='20' x2='40' y2='55' stroke='%23614e2a' stroke-width='0.6'/%3E%3C/svg%3E\")",
                backgroundSize: "70px 70px",
                backgroundRepeat: "repeat",
              }}
            />

            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: "rgba(97,78,42,0.15)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#614e2a" strokeWidth="1.8" className="h-5 w-5">
                <circle cx="12" cy="5" r="2" />
                <circle cx="5" cy="19" r="2" />
                <circle cx="19" cy="19" r="2" />
                <line x1="12" y1="7" x2="5" y2="17" strokeLinecap="round" />
                <line x1="12" y1="7" x2="19" y2="17" strokeLinecap="round" />
                <line x1="5" y1="19" x2="19" y2="19" strokeLinecap="round" />
              </svg>
            </div>

            <div>
              <h3 className="text-base font-bold text-[#2a1f0e]">Research Graph</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-[#614e2a]">
                Trace objections, sources, and Catholic responses.
              </p>
            </div>

            <div
              className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full"
              style={{ background: "#c9a227" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        </section>

        {/* ── EXPLORE KEY TOPICS ────────────────────────────────── */}
        <section className="px-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[#f4efe5]">
              {/* Sparkle */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#d4af37" aria-hidden="true">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
              </svg>
              Explore Key Topics
            </h2>
            <Link href="/library" className="text-xs font-medium text-[#d4af37] hover:underline">
              View all &rsaquo;
            </Link>
          </div>
          <TopicsScroll topics={featuredTopics} />
        </section>

        {/* ── VERSE OF THE DAY ──────────────────────────────────── */}
        <VerseOfTheDay />

        {/* ── YOUR STATS ───────────────────────────────────────── */}
        <StatsPanel />

        {/* ── SCRIPTURE QUOTE ───────────────────────────────────── */}
        <section className="mx-4 rounded-2xl px-5 py-6" style={{
          background: "linear-gradient(135deg, rgba(36,34,32,0.9) 0%, rgba(26,24,22,0.95) 100%)",
          border: "1px solid rgba(212,175,55,0.18)",
        }}>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              {/* Opening quote mark */}
              <svg width="24" height="18" viewBox="0 0 24 18" fill="#d4af37" aria-hidden="true" className="mb-2 opacity-60">
                <path d="M0 18V9.9C0 4.467 3.15 1.4 9.45 0L10.5 1.8C7.55 2.8 5.9 4.6 5.55 7.2H10.5V18H0zm13.5 0V9.9C13.5 4.467 16.65 1.4 22.95 0L24 1.8c-2.95 1-4.6 2.8-4.95 5.4H24V18H13.5z" />
              </svg>

              <p className="text-sm italic leading-relaxed text-[#c7bca8]">
                Always be ready to give an answer to everyone who asks you to give the reason for the hope that you have.
              </p>

              <p className="mt-3 text-right text-xs font-semibold tracking-widest text-[#d4af37]">
                1 Peter 3:15
              </p>
            </div>

            {/* Gold cross */}
            <div className="shrink-0 pt-1">
              <svg width="36" height="48" viewBox="0 0 36 48" fill="none" aria-hidden="true">
                <rect x="15" y="0" width="6" height="48" rx="2" fill="rgba(212,175,55,0.7)" />
                <rect x="0" y="12" width="36" height="6" rx="2" fill="rgba(212,175,55,0.7)" />
                {/* Inri-like accent */}
                <rect x="16" y="1" width="4" height="46" rx="1.5" fill="#d4af37" opacity="0.4" />
                <rect x="1" y="13" width="34" height="4" rx="1.5" fill="#d4af37" opacity="0.4" />
              </svg>
            </div>
          </div>
        </section>

      </main>

      {/* ── BOTTOM TABS ───────────────────────────────────────────── */}

    </div>
  );
}
