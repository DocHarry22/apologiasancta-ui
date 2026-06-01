import { cookies } from "next/headers";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/currentUser";
import AuthorSidebar from "./AuthorSidebar";

export default async function AuthorLayout({ children }: { children: React.ReactNode }) {
  let currentUser = null;
  try {
    const cookieStore = await cookies();
    const session = await readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    currentUser = session ? await getCurrentUser(session.userId) : null;
  } catch {
    // Unauthenticated or unavailable user: render children without sidebar.
  }

  if (!currentUser) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AuthorSidebar user={currentUser} />
      <div className="flex-1 overflow-auto min-w-0">{children}</div>
    </div>
  );
}
