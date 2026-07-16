import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { LeaderboardPageClient } from "@/components/leaderboard/LeaderboardPageClient";

export const metadata = { title: "Leaderboard | Apologia Sancta", description: "Real daily, weekly, and all-time Apologia Sancta live quiz rankings." };

export default function LeaderboardPage() {
  return (
    <AppShell>
      <div className="page-container py-8 sm:py-11">
        <header className="mb-7 flex flex-col gap-4 border-b border-(--border) pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow">Live competition</p><h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">Leaderboard</h1><p className="mt-3 max-w-2xl text-base leading-7 text-(--text-muted)">Rankings come from server-accepted live answers. Switch time period and score type independently.</p></div>
          <Link href="/mobile" className="btn-primary shrink-0">Join a room</Link>
        </header>
        <LeaderboardPageClient />
      </div>
    </AppShell>
  );
}
