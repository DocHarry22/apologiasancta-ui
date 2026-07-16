import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import { LearningDashboard } from "@/components/learn/LearningDashboard";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listTopicsWithCounts } from "@/lib/content";

export const metadata = {
  title: "Learn Catholic Apologetics | Apologia Sancta",
  description: "A structured, sourced Catholic apologetics learning path with progress and practice.",
};

export default async function LearnPage() {
  let topics: Awaited<ReturnType<typeof listTopicsWithCounts>> = [];
  try { topics = await listTopicsWithCounts(); } catch { /* sourced learning remains available */ }
  const cookieStore = await cookies();
  const authenticated = Boolean(await readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value));
  return <AppShell><LearningDashboard topics={topics} authenticated={authenticated} /></AppShell>;
}
