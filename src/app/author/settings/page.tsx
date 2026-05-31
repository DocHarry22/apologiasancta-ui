import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listPublishedQuestionRecords, listTopicsWithCounts } from "@/lib/content";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/currentUser";
import AuthorDashboardMounted from "@/components/author/AuthorDashboardMounted";

export const metadata = { title: "Settings | Apologia Sancta" };

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isValid = await verifySessionCookie(sessionValue);
  if (!isValid) redirect("/author/login?next=/author/settings");

  const [topics, publishedQuestions, currentUser] = await Promise.all([
    listTopicsWithCounts(),
    listPublishedQuestionRecords(),
    getCurrentUser(),
  ]);

  return (
    <AuthorDashboardMounted
      topics={topics}
      publishedQuestions={publishedQuestions}
      currentUser={currentUser}
      initialTab="settings"
    />
  );
}
