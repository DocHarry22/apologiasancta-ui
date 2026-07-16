import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listTopicsWithCounts } from "@/lib/content";
import { getCurrentUser } from "@/lib/server/currentUser";

export const metadata: Metadata = { title: "Apologia Sancta", description: "Defend the Faith. Learn the Truth." };

export default async function NativeHome() {
  let userName: string | null = null;
  const cookieStore = await cookies();
  const session = await readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (session) { try { userName = (await getCurrentUser(session.userId)).displayName; } catch { /* public native hub remains available */ } }
  let topics: Awaited<ReturnType<typeof listTopicsWithCounts>> = [];
  try { topics = await listTopicsWithCounts(); } catch { /* bundled lesson actions remain available */ }
  return <AppShell footer={false} mobileNavigation={false}><HomeDashboard userName={userName} topics={topics} /></AppShell>;
}
