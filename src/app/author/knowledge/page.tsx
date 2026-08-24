import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import KnowledgeFoundryAdvanced from "@/components/author/KnowledgeFoundryAdvanced";
import { hasAnyPermission } from "@/lib/auth/roles";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/currentUser";
import { isSessionFreshForUser } from "@/lib/server/sessionFreshness";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge Foundry | Apologia Sancta" };

export default async function AuthorKnowledgeFoundryPage() {
  const session = await readSessionCookie((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  if (!session) redirect("/author/login?next=/author/knowledge");
  const user = await getCurrentUser(session.userId);
  if (!isSessionFreshForUser(session, user)) redirect("/author/login?next=/author/knowledge");

  const canInspect = hasAnyPermission(user.role, ["learning:review", "learning:audit", "learning:manage"]);
  if (!canInspect) redirect("/author");

  const canPropose = hasAnyPermission(user.role, ["learning:manage", "content:draft:create"]);
  const canReview = hasAnyPermission(user.role, ["learning:review", "content:review"]);
  return <KnowledgeFoundryAdvanced canPropose={canPropose} canReview={canReview} />;
}
