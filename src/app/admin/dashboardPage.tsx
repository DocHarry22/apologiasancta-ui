import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listPublishedQuestionRecords, listTopicsWithCounts } from "@/lib/content";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/currentUser";
import AuthorDashboardMounted from "@/components/author/AuthorDashboardMounted";

export type DashboardTab = "overview" | "live" | "rooms" | "bank" | "authoring" | "review" | "topics" | "audit" | "settings";

export async function renderAdminDashboard(initialTab: DashboardTab, nextPath: string) {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionCookie(sessionValue);

  if (!session) {
    redirect(`${nextPath.startsWith("/admin") ? "/admin" : "/author"}/login?next=${encodeURIComponent(nextPath)}`);
  }

  const [topics, publishedQuestions, currentUser] = await Promise.all([
    listTopicsWithCounts(),
    listPublishedQuestionRecords(),
    getCurrentUser(session.userId),
  ]);

  return (
    <AuthorDashboardMounted
      topics={topics}
      publishedQuestions={publishedQuestions}
      currentUser={currentUser}
      initialTab={initialTab}
    />
  );
}
