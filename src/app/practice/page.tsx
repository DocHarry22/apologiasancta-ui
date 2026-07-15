import Link from "next/link";
import { PracticeQuiz } from "@/components/practice/PracticeQuiz";

export const metadata = {
  title: "Solo Practice | Apologia Sancta",
  description: "Practice sourced Catholic apologetics questions and review every explanation.",
};

export default function PracticePage() {
  return (
    <main className="min-h-screen bg-[#100f0d] px-4 py-8 text-[#f7f1e7] sm:px-6 sm:py-12">
      <div className="mx-auto mb-8 flex max-w-3xl items-center justify-between gap-4">
        <Link href="/learn" className="text-sm font-bold text-[#d8bd6a] hover:underline">← Learning path</Link>
        <Link href="/mobile" className="rounded-lg border border-white/12 px-3 py-2 text-sm font-bold hover:border-[#d4af37]/55">Play live</Link>
      </div>
      <PracticeQuiz />
    </main>
  );
}
