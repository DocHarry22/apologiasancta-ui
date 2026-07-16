"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isNativePlatform } from "@/lib/native";

const tabs = [
  { label: "Home", href: "/", icon: "⌂" },
  { label: "Learn", href: "/learn", icon: "▤" },
  { label: "Quiz", href: "/mobile", icon: "▶" },
  { label: "Library", href: "/library", icon: "▥" },
  { label: "Account", href: "/account", icon: "○" },
];

export function MobileBottomNavigation({ suppressOnNative = false }: { suppressOnNative?: boolean }) {
  const rawPathname = usePathname();
  const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/$/, "") : rawPathname;
  const [nativeState, setNativeState] = useState<boolean | null>(suppressOnNative ? null : false);
  useEffect(() => { if (suppressOnNative) setNativeState(isNativePlatform()); }, [suppressOnNative]);
  if (suppressOnNative && nativeState !== false) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-(--border) bg-(--tab-bg) pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] shadow-[var(--shadow-md)] backdrop-blur-xl lg:hidden"
      aria-label="Mobile navigation"
    >
      {tabs.map((tab) => {
        const current = tab.href === "/" ? pathname === "/" || pathname === "/native" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[0.68rem] font-semibold ${current ? "text-(--gold-hover)" : "text-(--text-muted)"}`}
          >
            <span className="text-xl leading-none" aria-hidden="true">{tab.icon}</span>
            <span className="truncate">{tab.label}</span>
            {current ? <span className="absolute inset-x-[28%] top-0 h-0.5 rounded-full bg-(--gold)" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
