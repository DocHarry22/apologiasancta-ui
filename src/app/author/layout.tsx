import { getCurrentUser } from "@/lib/server/currentUser";
import AuthorSidebar from "./AuthorSidebar";

export default async function AuthorLayout({ children }: { children: React.ReactNode }) {
  let currentUser = null;
  try {
    currentUser = await getCurrentUser();
  } catch {
    // Not authenticated — render children without sidebar (covers login page)
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
