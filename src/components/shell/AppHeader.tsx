"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BrandMark } from "./BrandMark";

const navigation = [
  { label: "Learn", href: "/learn" },
  { label: "Library", href: "/library" },
  { label: "Live Quiz", href: "/mobile" },
  { label: "Research", href: "/research" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Download App", href: "/download" },
];

function Icon({ name }: { name: "search" | "bell" | "user" }) {
  if (name === "search") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === "bell") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

function isCurrent(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-(--border) bg-(--nav-bg) backdrop-blur-xl">
      <div className="page-container flex min-h-[4.5rem] items-center justify-between gap-4">
        <BrandMark />
        <nav className="hidden h-[4.5rem] items-stretch gap-1 lg:flex" aria-label="Primary navigation">
          {navigation.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`relative flex items-center px-3 text-sm font-semibold transition-colors ${current ? "text-(--gold-hover)" : "text-(--text-muted) hover:text-(--text)"}`}
              >
                {item.label}
                {current ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-(--gold)" aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href="/download" className="hidden rounded-full border border-(--gold) px-3 py-2 text-xs font-bold text-(--gold-hover) transition hover:bg-(--surface-elevated) sm:inline-flex" aria-label="Download the Apologia Sancta app">
            Download App
          </Link>
          <Link href="/library#library-search" className="hidden h-10 w-10 items-center justify-center rounded-full text-(--text-muted) hover:bg-(--surface-elevated) hover:text-(--text) sm:flex" aria-label="Search the library">
            <span className="h-5 w-5 fill-none stroke-current stroke-2"><Icon name="search" /></span>
          </Link>
          <Link href="/account?section=notifications" className="hidden h-10 w-10 items-center justify-center rounded-full text-(--text-muted) hover:bg-(--surface-elevated) hover:text-(--text) sm:flex" aria-label="Notifications">
            <span className="h-5 w-5 fill-none stroke-current stroke-2"><Icon name="bell" /></span>
          </Link>
          <ThemeToggle />
          <Link href="/account" className="ml-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-(--border) bg-(--surface-elevated) text-(--text-muted) hover:border-(--gold) hover:text-(--gold-hover)" aria-label="Account">
            <span className="h-5 w-5 fill-none stroke-current stroke-[1.8]"><Icon name="user" /></span>
          </Link>
        </div>
      </div>
    </header>
  );
}
