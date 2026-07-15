import Link from "next/link";
import { LearningDashboard } from "@/components/learn/LearningDashboard";

export const metadata = {
  title: "Learn Catholic Apologetics | Apologia Sancta",
  description: "A structured, sourced Catholic apologetics learning path with progress and practice.",
};

export default function LearnPage() {
  return (
    <main className="min-h-screen bg-[#100f0d] text-[#f7f1e7]">
      <header className="border-b border-white/8 bg-[#100f0d]/95">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="font-bold text-[#f7f1e7] hover:text-[#e4c760]">✠ Apologia Sancta</Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-[#a99f90]" aria-label="Learning navigation">
            <Link href="/practice" className="hover:text-[#e4c760]">Practice</Link>
            <Link href="/library" className="hidden hover:text-[#e4c760] sm:inline">Library</Link>
            <Link href="/mobile" className="rounded-lg bg-[#d4af37] px-3 py-2 font-bold text-[#17130a]">Play live</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><LearningDashboard /></div>
    </main>
  );
}
