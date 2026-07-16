import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountDashboard, type AccountSection } from "@/components/account/AccountDashboard";
import { AppShell } from "@/components/shell/AppShell";
import { roleLabels } from "@/lib/auth/roles";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { learningPath, practiceQuestions } from "@/lib/learningContent";
import { listTopicsWithCounts } from "@/lib/content";
import { getCurrentUser, type CurrentUser } from "@/lib/server/currentUser";
import { isSessionFreshForUser } from "@/lib/server/sessionFreshness";

export const metadata: Metadata = {
  title: "Account",
  description: "Review your Apologia Sancta profile, device progress, appearance, and security settings.",
};

const accountSections: ReadonlySet<AccountSection> = new Set([
  "overview",
  "learning",
  "quiz",
  "saved",
  "appearance",
  "security",
  "notifications",
  "privacy",
]);

function requestedSection(value: string | string[] | undefined): AccountSection {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && accountSections.has(candidate as AccountSection)
    ? candidate as AccountSection
    : "overview";
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const cookieStore = await cookies();
  const session = await readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) redirect("/login?next=%2Faccount");

  let currentUser: CurrentUser;
  try {
    currentUser = await getCurrentUser(session.userId);
  } catch {
    redirect("/login?reason=session_expired&next=%2Faccount");
  }

  if (!isSessionFreshForUser(session, currentUser)) {
    redirect("/login?reason=session_expired&next=%2Faccount");
  }

  const params = await searchParams;
  const section = requestedSection(params.section);
  let topicOptions: Awaited<ReturnType<typeof listTopicsWithCounts>> = [];
  try { topicOptions = await listTopicsWithCounts(); } catch { /* account remains available without the bundled catalogue */ }
  const savedResourceOptions = [
    ...topicOptions.map((topic) => ({ id: topic.id, title: topic.title, href: `/library/${topic.id}` })),
    ...learningPath.lessons.map((lesson) => ({ id: `lesson-${lesson.id}`, title: lesson.title, href: `/learn/${lesson.id}` })),
  ];

  return (
    <AppShell>
      <AccountDashboard
        initialSection={section}
        profile={{
          displayName: currentUser.displayName,
          email: currentUser.email ?? null,
          roleLabel: roleLabels[currentUser.role],
          accountType: currentUser.accountType,
          phone: currentUser.phone ?? null,
          createdAt: currentUser.createdAt ?? null,
          lastLoginAt: currentUser.lastLoginAt ?? null,
        }}
        learningPathTitle={learningPath.title}
        learningLessonIds={learningPath.lessons.map((lesson) => lesson.id)}
        practiceQuestionCount={practiceQuestions.length}
        savedResourceOptions={savedResourceOptions}
      />
    </AppShell>
  );
}
