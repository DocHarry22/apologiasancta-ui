import Link from "next/link";
import { LeaderboardPageClient } from "@/components/leaderboard/LeaderboardPageClient";

export const metadata = {
  title: "Leaderboard | Apologia Sancta",
  description: "Daily, weekly, and all-time Apologia Sancta live quiz rankings.",
};

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen bg-[#100f0d] px-4 py-8 text-[#f7f1e7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-bold text-[#d8bd6a] hover:underline">← Home</Link>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.24em] text-[#d4af37]">Live competition</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Leaderboard</h1>
            <p className="mt-3 max-w-xl text-[#9f9586]">Rankings are generated from server-accepted live answers.</p>
          </div>
          <Link href="/mobile" className="shrink-0 rounded-xl bg-[#d4af37] px-4 py-3 text-sm font-bold text-[#17130a]">Join a room</Link>
        </header>
        <LeaderboardPageClient />
      </div>
    </main>
  );
}
