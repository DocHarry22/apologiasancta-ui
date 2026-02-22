import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { EngineTopicsList } from "@/components/library/EngineTopicsList";

export const metadata = {
  title: "Library | Apologia Sancta",
};

export default function LibraryPage() {
  const showAuthorLink = process.env.NEXT_PUBLIC_AUTHOR_ENABLED === "true";

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-(--border) p-2 text-(--muted) hover:border-(--accent) hover:text-(--accent) transition-colors"
              aria-label="Home"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-(--muted)">Quiz Library</p>
              <h1 className="text-3xl font-semibold">Topics</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {showAuthorLink && (
              <Link
                href="/author"
                className="shrink-0 rounded-lg border border-(--border) px-3 py-1.5 text-xs font-medium text-(--muted) hover:border-(--accent) hover:text-(--accent) transition-colors"
              >
                Author
              </Link>
            )}
          </div>
        </header>
        <EngineTopicsList />
      </div>
    </main>
  );
}
