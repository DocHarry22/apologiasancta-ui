import Link from "next/link";
import { getTopicsIndex } from "@/lib/content";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata = {
  title: "Library | Apologia Sancta",
};

export default async function LibraryPage() {
  const index = await getTopicsIndex();
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

        <section className="grid gap-3 sm:grid-cols-2">
          {index.topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/library/${topic.id}`}
              className="rounded-xl border border-(--border) bg-(--card) p-4 hover:border-(--accent) transition-colors"
            >
              <h2 className="text-lg font-semibold">{topic.title}</h2>
              <p className="mt-1 text-sm text-(--text-secondary)">{topic.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-(--muted)">{topic.questionCount} questions</span>
                <span className="text-xs text-(--accent)">Open</span>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
