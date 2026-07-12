"use client";

import Link from "next/link";
import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useQuizEntryGate } from "@/hooks/useQuizEntryGate";
import { getResearchGraphUrl } from "@/lib/publicEnv";

interface Tab {
  label: string;
  href: string;
  external?: boolean;
  icon: React.ReactNode;
}

const coreTabs: Tab[] = [
  {
    label: "Home",
    href: "/native",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Quiz",
    href: "/mobile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Resources",
    href: "/library",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function NativeBottomTabs() {
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const researchUrl = getResearchGraphUrl();
  const tabs: Tab[] = researchUrl ? [...coreTabs, {
    label: "Research",
    href: researchUrl,
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
        <circle cx="12" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <line x1="12" y1="7" x2="5" y2="17" strokeLinecap="round" />
        <line x1="12" y1="7" x2="19" y2="17" strokeLinecap="round" />
        <line x1="5" y1="19" x2="19" y2="19" strokeLinecap="round" />
      </svg>
    ),
  }] : coreTabs;
  const { requestQuizEntry, onboardingModals } = useQuizEntryGate();
  const handleQuizPress = useCallback(() => {
    requestQuizEntry();
  }, [requestQuizEntry]);

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex min-h-16 max-w-5xl items-stretch"
        style={{
          background: "rgba(17,16,15,0.97)",
          borderTop: "1px solid rgba(212,175,55,0.18)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
          backdropFilter: "blur(12px)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = !tab.external && (normalizedPathname === tab.href || (tab.href !== "/native" && normalizedPathname.startsWith(`${tab.href}/`)));
          const isQuizTab = tab.href === "/mobile";

          const inner = (
            <span className="flex flex-col items-center gap-1 py-2">
              <span
                style={{
                  color: isActive ? "#d4af37" : "rgba(196,191,181,0.6)",
                  transition: "color 0.15s",
                }}
              >
                {tab.icon}
              </span>
              <span
                className="text-[10px] font-medium tracking-wide"
                style={{ color: isActive ? "#d4af37" : "rgba(196,191,181,0.5)" }}
              >
                {tab.label}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-0 h-0.5 w-10 rounded-t-full"
                  style={{ background: "#d4af37" }}
                />
              )}
            </span>
          );

          if (tab.external) {
            return (
              <a
                key={tab.label}
                href={tab.href}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex min-h-14 flex-1 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#d4af37]"
              >
                {inner}
              </a>
            );
          }

          if (isQuizTab) {
            return (
              <button
                key={tab.label}
                type="button"
                onClick={handleQuizPress}
                className="relative flex min-h-14 flex-1 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#d4af37]"
                aria-label="Open quiz"
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className="relative flex min-h-14 flex-1 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#d4af37]"
            >
              {inner}
            </Link>
          );
        })}
      </nav>

      {onboardingModals}
    </>
  );
}
