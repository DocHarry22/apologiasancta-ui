"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { roleLabels } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/server/currentUser";
import { runWithStoredAccountSessionBoundary } from "@/lib/playerIdentity";
import { AppIcon, type AppIconName } from "@/components/native/AppIcon";
import { NativeHeader } from "@/components/native/NativeHeader";
import { Crest } from "@/components/shell/BrandMark";
import styles from "./StaffWorkspace.module.css";

const NAV_ITEMS: { id: string; label: string; path: string; icon: AppIconName }[] = [
  { id: "overview", label: "Overview", path: "", icon: "home" },
  { id: "live", label: "Live Control", path: "/live", icon: "signal" },
  { id: "rooms", label: "Rooms", path: "/rooms", icon: "chat" },
  { id: "bank", label: "Question Bank", path: "/bank", icon: "library" },
  { id: "authoring", label: "Authoring", path: "/authoring", icon: "book" },
  { id: "review", label: "Review", path: "/review", icon: "check" },
  { id: "topics", label: "Topics", path: "/topics", icon: "list" },
  { id: "learning", label: "Learning CMS", path: "/learning", icon: "book" },
  { id: "agent", label: "Research Agent", path: "/agent", icon: "research" },
  { id: "knowledge", label: "Knowledge Foundry", path: "/knowledge", icon: "research" },
  { id: "audit", label: "Audit", path: "/audit", icon: "shield" },
  { id: "notifications", label: "Notifications", path: "/notifications", icon: "bell" },
  { id: "settings", label: "Settings", path: "/settings", icon: "account" },
];

export default function AuthorSidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname().replace(/\/$/, "");
  const { theme, toggleTheme } = useTheme();
  const basePath = pathname.startsWith("/admin") ? "/admin" : "/author";
  const items = NAV_ITEMS.filter((item) => item.id !== "agent" || basePath === "/admin");
  const isActive = (href: string) => href === basePath ? pathname === basePath : pathname === href || pathname.startsWith(`${href}/`);

  if (pathname === `${basePath}/login`) return null;

  const navigation = <>{items.map((item) => {
    const href = `${basePath}${item.path}`;
    return <Link key={item.id} href={href} className={styles.link} aria-current={isActive(href) ? "page" : undefined} onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}><AppIcon name={item.icon} /><span>{item.label}</span></Link>;
  })}<Link href="/mobile" className={styles.link}><AppIcon name="play" /><span>Back to Quiz</span></Link></>;

  const account = <div className={styles.footer}>
    <p>{user.displayName}<small>{roleLabels[user.role]}</small></p>
    <div><button type="button" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? "Light" : "Dark"}</button>
      <form method="post" action={`/api/auth/logout?next=${encodeURIComponent(`${basePath}/login`)}`} onSubmit={(event) => {
        event.preventDefault();
        void runWithStoredAccountSessionBoundary(() => fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }))
          .catch(() => undefined)
          .finally(() => { window.location.href = `${basePath}/login`; });
      }}><button type="submit">Log out</button></form>
    </div>
  </div>;

  return <>
    <div className={styles.mobile}>
      <NativeHeader />
      <details key={pathname}>
        <summary><span>Staff workspace</span><strong>{items.find((item) => isActive(`${basePath}${item.path}`))?.label ?? "Workspace"}</strong></summary>
        <nav className={styles.navigation} aria-label="Mobile staff navigation">{navigation}</nav>
        {account}
      </details>
    </div>
    <aside className={styles.sidebar}>
      <Link href={basePath} className={styles.brand}><Crest /><span>Apologia Sancta<small>Staff workspace</small></span></Link>
      <nav className={styles.navigation} aria-label="Staff navigation">{navigation}</nav>
      {account}
    </aside>
  </>;
}
