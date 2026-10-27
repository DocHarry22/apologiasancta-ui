import { cookies } from "next/headers";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/currentUser";
import AuthorSidebar from "./AuthorSidebar";
import styles from "./StaffWorkspace.module.css";

export default async function AuthorLayout({ children }: { children: React.ReactNode }) {
  let currentUser = null;
  try {
    const cookieStore = await cookies();
    const session = await readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    currentUser = session ? await getCurrentUser(session.userId) : null;
  } catch {
    // Unauthenticated or unavailable user: render children without sidebar.
  }

  if (!currentUser || currentUser.accountType !== "staff") {
    return <>{children}</>;
  }

  return (
    <div className={styles.workspace}>
      <AuthorSidebar user={currentUser} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
