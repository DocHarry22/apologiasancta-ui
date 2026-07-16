"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Crest } from "@/components/shell/BrandMark";
import type { ConnectionStatus } from "@/types/quiz";
import { getConnectionLabel } from "@/lib/mobileUx";

interface TopBarProps {
  topic?: string;
  roomName?: string;
  questionNumber?: number;
  totalQuestions?: number;
  connectionStatus?: ConnectionStatus;
  onOpenAdmin?: () => void;
  onSwitchRoom?: () => void;
}

export function TopBar({
  topic,
  roomName,
  questionNumber,
  totalQuestions,
  connectionStatus = "connected",
  onOpenAdmin,
  onSwitchRoom,
}: TopBarProps) {
  const statusConfig: Record<ConnectionStatus, { dotClass: string; bgClass: string; animate: boolean }> = {
    connected: { dotClass: "bg-white", bgClass: "bg-green-600", animate: true },
    connecting: { dotClass: "bg-white/70", bgClass: "bg-sky-600", animate: false },
    reconnecting: { dotClass: "bg-yellow-200", bgClass: "bg-yellow-600", animate: true },
    polling: { dotClass: "bg-white", bgClass: "bg-blue-600", animate: true },
    disconnected: { dotClass: "bg-white/60", bgClass: "bg-red-600", animate: false },
  };

  const status = statusConfig[connectionStatus];

  return (
    <header className="sticky top-0 z-30 flex max-w-full flex-col items-center overflow-hidden border-b border-(--mobile-border) bg-(--mobile-surface) px-3 py-2 shadow-[0_8px_30px_var(--mobile-shadow)] backdrop-blur-md lg:static lg:border-b-0 lg:bg-transparent lg:shadow-none">
      <div className="flex w-full items-center justify-between gap-2">
        <Link
          href="/"
          className="rounded-full p-2 text-(--mobile-muted) transition-colors hover:text-foreground"
          aria-label="Home"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <Crest className="h-7 w-6 shrink-0" />
          <h1 className="truncate text-[13px] font-semibold tracking-[0.12em] text-(--mobile-text) sm:text-sm">
            <span className="text-(--accent)">A</span>
            <span>POLOGIA </span>
            <span className="text-(--accent)">S</span>
            <span>ANCTA </span>
            <span className="font-bold text-(--mobile-blue)">LIVE</span>
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />

          <div className={`flex items-center gap-1 rounded-md px-2 py-1 text-white shadow-sm ${status.bgClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass} ${status.animate ? "live-dot" : ""}`} />
            <span className="text-[10px] font-bold">{getConnectionLabel(connectionStatus)}</span>
          </div>

          {onOpenAdmin ? (
            <button
              onClick={onOpenAdmin}
              className="hidden rounded-lg border border-(--mobile-border) bg-(--mobile-elevated) px-2.5 py-1 text-[10px] font-semibold text-(--mobile-muted) transition-colors hover:border-(--accent) hover:text-(--accent) sm:block"
              aria-label="Open admin panel"
            >
              Admin
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        {roomName ? (
          <button
            type="button"
            onClick={onSwitchRoom}
            className="col-span-2 inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-(--mobile-border) bg-(--mobile-elevated) px-3 py-1.5 text-[11px] font-semibold text-(--mobile-muted) transition-colors hover:border-(--accent) hover:text-foreground sm:col-span-1"
          >
            <span className="truncate">{roomName}</span>
            {onSwitchRoom ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            ) : null}
          </button>
        ) : null}

        {topic ? (
          <span className="min-w-0 truncate rounded-full border border-(--accent) bg-(--mobile-blue) px-3 py-1.5 text-center text-[10px] font-bold tracking-[0.12em] text-white shadow-sm">
            {topic}
          </span>
        ) : null}

        {questionNumber && totalQuestions ? (
          <span className="whitespace-nowrap text-right text-[11px] font-semibold text-(--mobile-muted)">
            <span className="sm:hidden">Q<span className="font-bold text-(--mobile-text)">{questionNumber}</span>/{totalQuestions}</span>
            <span className="hidden sm:inline">Question <span className="font-bold text-(--mobile-text)">{questionNumber}</span> of {totalQuestions}</span>
          </span>
        ) : null}
      </div>
    </header>
  );
}
