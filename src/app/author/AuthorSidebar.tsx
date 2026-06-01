"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { roleLabels } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/server/currentUser";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", path: "", icon: "+" },
  { id: "live", label: "Live Control", path: "/live", icon: ">" },
  { id: "rooms", label: "Rooms", path: "/rooms", icon: "[]" },
  { id: "bank", label: "Question Bank", path: "/bank", icon: "#" },
  { id: "authoring", label: "Authoring", path: "/authoring", icon: "E" },
  { id: "review", label: "Review", path: "/review", icon: "V" },
  { id: "topics", label: "Topics", path: "/topics", icon: "=" },
  { id: "audit", label: "Audit", path: "/audit", icon: "!" },
  { id: "settings", label: "Settings", path: "/settings", icon: "*" },
];

export default function AuthorSidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const basePath = pathname.startsWith("/admin") ? "/admin" : "/author";

  const isActive = (href: string) => {
    if (href === basePath) return pathname === basePath;
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push(`${basePath}/login`);
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-(--border) bg-(--card) sticky top-0 h-screen">
      <div className="border-b border-(--border) px-4 py-4">
        <Link href={basePath} className="block group">
          <p className="text-[10px] uppercase tracking-[0.18em] text-(--muted)">Admin Dashboard</p>
          <p className="mt-1 text-sm font-semibold text-(--accent) group-hover:opacity-80 transition-opacity">
            + Apologia Sancta
          </p>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => {
          const href = `${basePath}${item.path}`;
          return (
            <Link
              key={item.id}
              href={href}
              className={`flex min-h-10 items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                isActive(href)
                  ? "border-r-2 border-(--accent) bg-(--accent)/10 font-medium text-(--accent)"
                  : "text-(--text-secondary) hover:bg-(--ticker-bg) hover:text-(--text)"
              }`}
            >
              <span className="w-4 shrink-0 text-center text-xs opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <div className="mx-4 my-2 border-t border-(--border)" />

        <Link
          href="/mobile"
          className="flex min-h-10 items-center gap-2.5 px-4 py-2 text-sm text-(--muted) hover:text-(--text) transition-colors"
        >
          <span className="w-4 shrink-0 text-center text-xs opacity-70">{"<"}</span>
          Back to Quiz
        </Link>
      </nav>

      <div className="shrink-0 border-t border-(--border) p-3 space-y-2">
        <div className="rounded-lg border border-(--border) px-3 py-2 min-w-0">
          <p className="truncate text-xs font-medium">{user.displayName}</p>
          <p className="text-[11px] text-(--muted) truncate">{roleLabels[user.role]}</p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex-1 rounded-lg border border-(--border) py-1.5 text-xs text-(--muted) hover:border-(--accent) hover:text-(--accent) transition-colors"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex-1 rounded-lg border border-(--border) py-1.5 text-xs text-(--muted) hover:border-red-500 hover:text-red-500 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
