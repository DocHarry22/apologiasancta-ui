import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { LeaderboardPageClient } from "@/components/leaderboard/LeaderboardPageClient";
import { AppIcon } from "@/components/native/AppIcon";
import study from "@/components/native/StudyUI.module.css";

export const metadata = { title: "Leaderboard | Apologia Sancta", description: "Real daily, weekly, and all-time Apologia Sancta live quiz rankings." };

export default function LeaderboardPage() {
  return (
    <AppShell>
      <div className={study.screen}>
        <header className={study.intro}><p className={study.eyebrow}>Community leaderboard</p><h1 className={study.title}>A little practice.<br /><em>A place to shine.</em></h1><p className={study.introDescription}>Celebrate progress with the community. Explore live quiz scores and longest streaks.</p></header>
        <LeaderboardPageClient />
        <section className={study.compactFeature}><div><h2>Ready for your next question?</h2><p>Join a live room and put your learning into practice.</p></div><Link href="/mobile" aria-label="Join a live quiz"><AppIcon name="arrow" width={21} height={21} /></Link></section>
      </div>
    </AppShell>
  );
}
