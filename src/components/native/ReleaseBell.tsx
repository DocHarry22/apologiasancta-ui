"use client";

import { SHOW_WHATS_NEW_EVENT } from "@/components/releases/WhatsNewPopup";

export function ReleaseBell() {
  return (
    <button
      type="button"
      aria-label="Show latest updates"
      title="What’s new"
      onClick={() => window.dispatchEvent(new Event(SHOW_WHATS_NEW_EVENT))}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#c7bca8] transition-colors hover:text-[#d4af37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4af37]"
      style={{ background: "rgba(212,175,55,0.08)" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
