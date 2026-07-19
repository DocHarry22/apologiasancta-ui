import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LearningCms from "@/components/author/LearningCms";
import { hasPermission } from "@/lib/auth/roles";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/currentUser";
import { isSessionFreshForUser } from "@/lib/server/sessionFreshness";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learning CMS | Apologia Sancta" };

export default async function LearningCmsPage() {
  const session = await readSessionCookie((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  if (!session) redirect("/admin/login?next=/admin/learning");
  const user = await getCurrentUser(session.userId);
  if (!isSessionFreshForUser(session, user)) redirect("/admin/login?next=/admin/learning");
  if (!hasPermission(user.role, "learning:manage") && !hasPermission(user.role, "learning:review")) redirect("/admin");
  return <LearningCms />;
}
