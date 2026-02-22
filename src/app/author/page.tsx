import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listTopicsWithCounts } from "@/lib/content";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/auth/session";
import AuthorDashboardMounted from "@/components/author/AuthorDashboardMounted";

export const metadata = {
  title: "Author Dashboard | Apologia Sancta",
};

export default async function AuthorPage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isValid = await verifySessionCookie(sessionValue);

  if (!isValid) {
    redirect("/author/login?next=/author");
  }

  const topics = await listTopicsWithCounts();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AuthorDashboardMounted topics={topics} />
    </main>
  );
}
