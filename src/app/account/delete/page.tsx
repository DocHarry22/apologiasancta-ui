import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DeleteAccountPanel } from "@/components/account/DeleteAccountPanel";
import { AppShell } from "@/components/shell/AppShell";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/currentUser";
import { isSessionFreshForUser } from "@/lib/server/sessionFreshness";

export const metadata: Metadata = {
  title: "Delete Account",
  description: "Delete an Apologia Sancta learner account and its account-linked learning data.",
};

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const cookieStore = await cookies();
  const session = await readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  let accountType: "public" | "staff" | null = null;
  if (session) {
    try {
      const user = await getCurrentUser(session.userId);
      if (isSessionFreshForUser(session, user)) accountType = user.accountType;
    } catch {
      accountType = null;
    }
  }

  return (
    <AppShell>
      <div className="page-container py-10 sm:py-14">
        <DeleteAccountPanel signedIn={accountType !== null} accountType={accountType} />
      </div>
    </AppShell>
  );
}
