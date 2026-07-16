import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listTopicsWithCounts } from "@/lib/content";
import { getCurrentUser } from "@/lib/server/currentUser";

export default async function Home() {
  let userName: string | null = null;
  const cookieStore = await cookies();
  const session = await readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (session) {
    try { userName = (await getCurrentUser(session.userId)).displayName; } catch { /* public hub remains available */ }
  }

  let topics: Awaited<ReturnType<typeof listTopicsWithCounts>> = [];
  try { topics = await listTopicsWithCounts(); } catch { /* Home renders an honest empty featured section */ }

  return (
    <AppShell>
      <HomeDashboard userName={userName} topics={topics} />
    </AppShell>
  );
}
