"use client";

import Link from "next/link";
import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useQuizEntryGate } from "@/hooks/useQuizEntryGate";

const tabs = [
  { label: "Home", href: "/native", icon: "⌂" },
  { label: "Learn", href: "/learn", icon: "▤" },
  { label: "Quiz", href: "/mobile", icon: "▶" },
  { label: "Library", href: "/library", icon: "▥" },
  { label: "Account", href: "/account", icon: "○" },
];

export function NativeBottomTabs() {
  const pathname = usePathname();
  const currentPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const { requestQuizEntry, onboardingModals } = useQuizEntryGate();
  const handleQuizPress = useCallback(() => requestQuizEntry(), [requestQuizEntry]);
  return <>
    <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-50 mx-auto grid max-w-5xl grid-cols-5 border-t border-(--border) bg-(--tab-bg) px-[env(safe-area-inset-left,0px)] pb-[env(safe-area-inset-bottom,0px)] pr-[env(safe-area-inset-right,0px)] backdrop-blur-xl">
      {tabs.map((tab) => {
        const current = currentPath === tab.href || (tab.href !== "/native" && currentPath.startsWith(`${tab.href}/`));
        const inner = <><span className="text-xl" aria-hidden="true">{tab.icon}</span><span className="truncate text-[0.68rem] font-semibold">{tab.label}</span>{current ? <span className="absolute inset-x-[28%] top-0 h-0.5 bg-(--gold)" aria-hidden="true" /> : null}</>;
        const className = `relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 ${current ? "text-(--gold-hover)" : "text-(--text-muted)"}`;
        return tab.href === "/mobile" ? <button key={tab.href} type="button" className={className} onClick={handleQuizPress} aria-label="Open quiz">{inner}</button> : <Link key={tab.href} href={tab.href} className={className} aria-current={current ? "page" : undefined}>{inner}</Link>;
      })}
    </nav>
    {onboardingModals}
  </>;
}
