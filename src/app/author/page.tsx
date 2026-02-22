import Link from "next/link";
import { listTopicsWithCounts } from "@/lib/content";
import AuthorDashboardClient from "@/components/author/AuthorDashboardClient";

export const metadata = {
  title: "Author Dashboard | Apologia Sancta",
};

export default async function AuthorPage() {
  const authorEnabled = process.env.NEXT_PUBLIC_AUTHOR_ENABLED === "true";

  if (!authorEnabled) {
    return (
      <main className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold">Author Mode Disabled</h1>
          <p className="text-sm text-(--muted)">
            Set NEXT_PUBLIC_AUTHOR_ENABLED=true to enable the author dashboard.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-(--border) px-4 py-2 text-sm text-(--muted) hover:border-(--accent) hover:text-(--accent) transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const topics = await listTopicsWithCounts();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AuthorDashboardClient topics={topics} />
    </main>
  );
}
