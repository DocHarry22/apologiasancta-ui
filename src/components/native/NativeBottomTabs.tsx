"use client";

import Link from "next/link";
import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useQuizEntryGate } from "@/hooks/useQuizEntryGate";
import { AppIcon, type AppIconName } from "./AppIcon";
import styles from "./NativeNavigation.module.css";

const tabs = [
  { label: "Home", href: "/native", icon: "home" },
  { label: "Learn", href: "/learn", icon: "book" },
  { label: "Quiz", href: "/mobile", icon: "play" },
  { label: "Library", href: "/library", icon: "library" },
  { label: "Account", href: "/account", icon: "account" },
] satisfies Array<{ label: string; href: string; icon: AppIconName }>;

export function NativeBottomTabs() {
  const pathname = usePathname();
  const currentPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const { requestQuizEntry, onboardingModals } = useQuizEntryGate();
  const handleQuizPress = useCallback(() => requestQuizEntry(), [requestQuizEntry]);
  return <>
    <nav aria-label="Primary navigation" className={styles.navigation}>
      {tabs.map((tab) => {
        const current = currentPath === tab.href || (tab.href === "/native" && currentPath === "/") || (tab.href !== "/native" && currentPath.startsWith(`${tab.href}/`));
        const inner = <><span className={styles.icon}><AppIcon name={tab.icon} width={22} height={22} /></span><span>{tab.label}</span></>;
        return tab.href === "/mobile" ? <button key={tab.href} type="button" className={styles.tab} onClick={handleQuizPress} aria-current={current ? "page" : undefined} aria-label="Open quiz">{inner}</button> : <Link key={tab.href} href={tab.href} className={styles.tab} aria-current={current ? "page" : undefined}>{inner}</Link>;
      })}
    </nav>
    {onboardingModals}
  </>;
}
