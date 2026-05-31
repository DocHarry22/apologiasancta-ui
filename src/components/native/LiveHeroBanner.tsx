"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EngineStatus {
  running: boolean;
  connectedClients: number;
  phase: string;
}

interface LiveHeroBannerProps {
  engineUrl: string;
}

export function LiveHeroBanner({ engineUrl }: LiveHeroBannerProps) {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`${engineUrl}/`, { cache: "no-store" });
        if (!res.ok) throw new Error("Non-OK response");
        const data = await res.json();
        if (!cancelled) {
          setStatus({
            running: data.controller?.running ?? false,
            connectedClients: data.controller?.connectedClients ?? 0,
            phase: data.controller?.phase ?? "idle",
          });
        }
      } catch {
        // Engine unreachable — leave status null (fallback UI shown)
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [engineUrl]);

  const isLive = status?.running === true;
  const participants = status?.connectedClients ?? 0;

  return (
    <section
      className="relative mx-4 mt-4 overflow-hidden rounded-2xl"
      style={{
        background:
          "linear-gradient(135deg, #1a1816 0%, #2a2218 50%, #1a1410 100%)",
        border: "1px solid rgba(212,175,55,0.25)",
        minHeight: "220px",
      }}
    >
      {/* Background cathedral silhouette — subtle radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 75% 50%, rgba(212,175,55,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 p-6">
        {/* Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur-sm">
          {loading ? (
            <span className="h-2 w-2 rounded-full bg-white/40" />
          ) : isLive ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-yellow-400/70" />
          )}
          {loading ? "Checking…" : isLive ? "Live Now" : "Upcoming"}
        </div>

        {/* Heading */}
        <h2 className="mb-2 text-3xl font-bold leading-tight text-white">
          Join the Live
          <br />
          Apologetics Quiz
        </h2>

        {/* Description */}
        <p className="mb-4 max-w-55 text-sm leading-relaxed text-white/70">
          Real-time quiz rounds with teaching moments and Catholic apologetics insights.
        </p>

        {/* Stats row */}
        {!loading && (
          <div className="mb-5 flex items-center gap-5 text-sm text-white/60">
            {isLive && (
              <span className="flex items-center gap-1.5">
                {/* people icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>
                  <strong className="text-white">{participants}</strong> Participants
                </span>
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <Link
          href="/mobile"
          className="inline-flex w-full items-center justify-center gap-3 rounded-xl px-5 py-3.5 text-base font-bold text-[#1a1408] transition-opacity hover:opacity-90 active:opacity-80"
          style={{
            background: "linear-gradient(90deg, #d4af37, #c9a227)",
            boxShadow: "0 4px 20px rgba(212,175,55,0.35)",
          }}
        >
          {/* Shield-swords icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z" opacity="0.3"/>
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2zm0 2.18l7 3.12V12c0 4.25-2.9 8.22-7 9.43C7.9 20.22 5 16.25 5 12V7.3L12 4.18z"/>
          </svg>
          Start Quiz
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
