"use client";

import { useTheme } from "@/lib/theme";
import type { ConnectionStatus } from "@/types/quiz";

interface TopBarProps {
  topic?: string;
  questionNumber?: number;
  totalQuestions?: number;
  connectionStatus?: ConnectionStatus;
  onOpenAdmin?: () => void;
}

export function TopBar({ topic, questionNumber, totalQuestions, connectionStatus = "connected", onOpenAdmin }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();

  // Connection status display
  const statusConfig = {
    connected: { text: "LIVE", dotClass: "bg-[color:var(--live-dot)]", animate: true },
    connecting: { text: "CONNECTING...", dotClass: "bg-[color:var(--muted)]", animate: false },
    reconnecting: { text: "RECONNECTING...", dotClass: "bg-yellow-500", animate: true },
    disconnected: { text: "OFFLINE", dotClass: "bg-[color:var(--muted)]", animate: false },
  };
  
  const status = statusConfig[connectionStatus];

  return (
    <header className="flex flex-col items-center py-2 px-3">
      {/* Top row */}
      <div className="flex items-center justify-between w-full">
        {/* Menu */}
        <button
          className="text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors p-1"
          aria-label="Menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
        </button>

        {/* Brand */}
        <div className="flex items-center gap-1">
          <span className="text-[color:var(--accent)] text-sm">✦</span>
          <h1 className="text-xs font-semibold tracking-wide">
            <span className="text-[color:var(--accent)]">A</span>
            <span className="text-[color:var(--text)]">POLOGIA </span>
            <span className="text-[color:var(--accent)]">S</span>
            <span className="text-[color:var(--text)]">ANCTA </span>
            <span className="text-[color:var(--accent2)] font-bold">LIVE</span>
          </h1>
        </div>

        {/* Right: Theme + Live + Admin */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors p-1"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass} ${status.animate ? "live-dot" : ""}`} />
            <span className="text-[10px] font-semibold text-[color:var(--text)]">{status.text}</span>
          </div>
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="text-[9px] px-1.5 py-0.5 rounded bg-[color:var(--muted)]/20 text-[color:var(--muted)] 
                hover:bg-[color:var(--accent)]/20 hover:text-[color:var(--accent)] transition-colors"
              aria-label="Open admin panel"
            >
              Admin
            </button>
          )}
        </div>
      </div>

      {/* Second row: Topic badge + Question count */}
      <div className="flex items-center gap-2 mt-1.5">
        {topic && (
          <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent2)] text-white text-[9px] font-semibold tracking-wider">
            {topic}
          </span>
        )}
        {questionNumber && totalQuestions && (
          <span className="text-[10px] text-[color:var(--muted)]">
            Question <span className="text-[color:var(--text)] font-semibold">{questionNumber}</span> of {totalQuestions}
          </span>
        )}
      </div>
    </header>
  );
}
