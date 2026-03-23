import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { InstallActions } from "@/components/home/InstallActions";
import { isEngineConfigured } from "@/lib/publicEnv";

export default function Home() {
  const authorEnabled = process.env.NEXT_PUBLIC_AUTHOR_ENABLED === "true";
  const engineConfigured = isEngineConfigured();

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-(--border) bg-(--card)">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Apologia Sancta
              </h1>
              <p className="text-sm text-(--text-secondary) max-w-md">
                Live apologetics quizzes, study library, and authoring tools.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-(--muted)">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Navigation Cards */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-(--muted)">
            Get Started
          </h2>
          <div className={`grid gap-4 ${authorEnabled ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"}`}>
            {/* Live Quiz Card */}
            <Link
              href="/mobile"
              className="group relative rounded-xl border border-(--border) bg-(--card) p-6 transition-all hover:border-(--accent) hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent)/10 text-(--accent)">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Live Quiz</h3>
                </div>
                <p className="text-sm text-(--text-secondary) leading-relaxed">
                  Join the active round, answer in real time, see streaks and leaders.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-(--accent) group-hover:gap-2 transition-all">
                    Open Live UI
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>

            {/* Library Card */}
            <Link
              href="/library"
              className="group relative rounded-xl border border-(--border) bg-(--card) p-6 transition-all hover:border-(--accent) hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent)/10 text-(--accent)">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Library</h3>
                </div>
                <p className="text-sm text-(--text-secondary) leading-relaxed">
                  Browse topics, questions, and teaching notes.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-(--accent) group-hover:gap-2 transition-all">
                    Browse Library
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>

            {/* Author Card (conditional) */}
            {authorEnabled && (
              <Link
                href="/author"
                className="group relative rounded-xl border border-(--border) bg-(--card) p-6 transition-all hover:border-(--accent) hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-background md:col-span-2 lg:col-span-1"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent)/10 text-(--accent)">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold">Author</h3>
                  </div>
                  <p className="text-sm text-(--text-secondary) leading-relaxed">
                    Create and validate questions, export JSON, grow the bank.
                  </p>
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-(--accent) group-hover:gap-2 transition-all">
                      Open Author
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>

        <InstallActions />

        {/* How It Works - Players */}
        <section className="mt-12 space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-(--muted)">
            How to Play
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Step 1 */}
            <div className="rounded-lg border border-(--border) bg-(--card)/50 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--accent) text-xs font-bold text-white">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-medium">Watch live on YouTube</h3>
                  <p className="mt-1 text-xs text-(--muted)">
                    Tune in to the stream when rounds begin.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-lg border border-(--border) bg-(--card)/50 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--accent) text-xs font-bold text-white">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-medium">Answer with !A !B !C !D</h3>
                  <p className="mt-1 text-xs text-(--muted)">
                    Type your answer in YouTube chat.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-lg border border-(--border) bg-(--card)/50 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--accent) text-xs font-bold text-white">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-medium">Learn from Teaching Moment</h3>
                  <p className="mt-1 text-xs text-(--muted)">
                    Discover the truth behind each question.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works - Authors */}
        {authorEnabled && (
          <section className="mt-8 space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-widest text-(--muted)">
              Content Workflow
            </h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-(--border) bg-(--card)/50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--accent) text-xs font-bold text-white">
                    1
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">Create &amp; Import</h3>
                    <p className="mt-1 text-xs text-(--muted)">
                      Author questions in the dashboard. Import commits to GitHub.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-(--border) bg-(--card)/50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--accent) text-xs font-bold text-white">
                    2
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">GitHub Sync</h3>
                    <p className="mt-1 text-xs text-(--muted)">
                      Engine auto-syncs from GitHub on startup. Library reads from repo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-(--border) bg-(--card)/50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--accent) text-xs font-bold text-white">
                    3
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">Set Pool &amp; Shuffle</h3>
                    <p className="mt-1 text-xs text-(--muted)">
                      Select topics, shuffle order, start the quiz session.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-(--border) bg-(--card)/50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--accent) text-xs font-bold text-white">
                    4
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">Go Live</h3>
                    <p className="mt-1 text-xs text-(--muted)">
                      Players see questions in real-time. Library always up-to-date.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-(--muted) italic">
              Content stored in GitHub. Engine syncs on startup or via admin/content/sync.
            </p>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-(--border) bg-(--card)/30">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-(--muted)">
              © Apologia Sancta
            </p>
            <div className="flex items-center gap-4 text-xs text-(--muted)">
              {engineConfigured ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-(--correct)" />
                  Engine configured
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-(--wrong)" />
                  Engine not configured
                </span>
              )}
              {!authorEnabled && (
                <span className="text-(--muted)/60">Author mode disabled</span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
