"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SHOW_WHATS_NEW_EVENT } from "@/components/releases/WhatsNewPopup";
import { ProgressBar, ProgressRing, SectionHeading, StatusBadge } from "@/components/ui/Primitives";
import { useScoreHistory } from "@/hooks/useScoreHistory";
import {
  LEARNING_PROGRESS_KEY,
  parseLearningProgress,
  type LearningProgress,
} from "@/lib/learningProgress";
import { LIBRARY_BOOKMARKS_KEY, parseLibraryBookmarks } from "@/lib/libraryBookmarks";
import { clearStoredPlayerIdentity, runWithStoredAccountSessionBoundary } from "@/lib/playerIdentity";
import { useTheme, type ThemePreference } from "@/lib/theme";

export type AccountSection =
  | "overview"
  | "learning"
  | "quiz"
  | "saved"
  | "appearance"
  | "security"
  | "notifications"
  | "privacy";

export interface AccountProfile {
  displayName: string;
  email: string | null;
  roleLabel: string;
  accountType: "staff" | "public";
  phone: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
}

interface AccountDashboardProps {
  profile: AccountProfile;
  initialSection: AccountSection;
  learningPathTitle: string;
  learningLessonIds: string[];
  practiceQuestionCount: number;
  savedResourceOptions: Array<{ id: string; title: string; href: string }>;
}

type OfficialLearningProgress = {
  lessons?: Array<{ lessonId?: string; state?: string; status?: string; readingProgressPercent?: number; progressPercent?: number }>;
  mastery?: { masteredAttemptCount?: number };
};

const sections: Array<{ id: AccountSection; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Profile and account summary" },
  { id: "learning", label: "Learning", description: "Device learning progress" },
  { id: "quiz", label: "Quiz history", description: "Recent device sessions" },
  { id: "saved", label: "Saved items", description: "Device library bookmarks" },
  { id: "appearance", label: "Appearance", description: "Theme preference" },
  { id: "security", label: "Security", description: "Password and sessions" },
  { id: "notifications", label: "Notifications", description: "Product update notices" },
  { id: "privacy", label: "Privacy", description: "Device data controls" },
];

function formatDate(value: string | null, includeTime = false): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : parts[0]?.slice(0, 2) || "AS").toUpperCase();
}

function DeviceOnlyBadge() {
  return <StatusBadge tone="warning">Saved only on this device</StatusBadge>;
}

function Message({ tone, children }: { tone: "success" | "error" | "info"; children: string }) {
  const styles = {
    success: "border-(--success) bg-(--correct-bg) text-(--success)",
    error: "border-(--danger) bg-(--wrong-bg) text-(--danger)",
    info: "border-(--blue) bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-(--text)",
  };
  return <p role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`rounded-lg border px-3 py-2.5 text-sm ${styles[tone]}`}>{children}</p>;
}

export function AccountDashboard({
  profile,
  initialSection,
  learningPathTitle,
  learningLessonIds,
  practiceQuestionCount,
  savedResourceOptions,
}: AccountDashboardProps) {
  const router = useRouter();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeSection, setActiveSection] = useState<AccountSection>(initialSection);
  const [learningProgress, setLearningProgress] = useState<LearningProgress>(() => parseLearningProgress(null));
  const [officialLearning, setOfficialLearning] = useState<OfficialLearningProgress | null>(null);
  const [privacyMessage, setPrivacyMessage] = useState("");
  const [learningClearArmed, setLearningClearArmed] = useState(false);
  const [savedResourceIds, setSavedResourceIds] = useState<string[]>([]);
  const { history, totalQuizzes, bestScore } = useScoreHistory();

  useEffect(() => {
    try {
      setLearningProgress(parseLearningProgress(window.localStorage.getItem(LEARNING_PROGRESS_KEY)));
      setSavedResourceIds(parseLibraryBookmarks(window.localStorage.getItem(LIBRARY_BOOKMARKS_KEY)));
    } catch {
      setLearningProgress(parseLearningProgress(null));
      setSavedResourceIds([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/learning/progress", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ data?: OfficialLearningProgress }> : null)
      .then((payload) => setOfficialLearning(payload?.data ?? null))
      .catch((error) => { if ((error as Error).name !== "AbortError") setOfficialLearning(null); });
    return () => controller.abort();
  }, []);

  const completedLessons = useMemo(() => {
    if (officialLearning) return officialLearning.lessons?.filter((lesson) => lesson.state === "completed" || lesson.status === "completed" || Number(lesson.readingProgressPercent ?? lesson.progressPercent) >= 100).length ?? 0;
    const knownLessons = new Set(learningLessonIds);
    return new Set(learningProgress.completedLessonIds.filter((id) => knownLessons.has(id))).size;
  }, [learningLessonIds, learningProgress.completedLessonIds, officialLearning]);
  const trackedLessonCount = officialLearning?.lessons?.length ?? learningLessonIds.length;
  const learningPercent = trackedLessonCount > 0
    ? Math.round((completedLessons / trackedLessonCount) * 100)
    : 0;

  const selectSection = (section: AccountSection, focus = false) => {
    setActiveSection(section);
    const url = new URL(window.location.href);
    if (section === "overview") url.searchParams.delete("section");
    else url.searchParams.set("section", section);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (focus) {
      const index = sections.findIndex((item) => item.id === section);
      window.setTimeout(() => tabRefs.current[index]?.focus(), 0);
    }
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (index + 1) % sections.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (index - 1 + sections.length) % sections.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = sections.length - 1;
    else return;
    event.preventDefault();
    selectSection(sections[nextIndex].id, true);
  };

  const clearLearningProgress = () => {
    if (!learningClearArmed) {
      setLearningClearArmed(true);
      setPrivacyMessage("Select confirm to permanently clear learning progress stored by this browser.");
      return;
    }
    try {
      window.localStorage.removeItem(LEARNING_PROGRESS_KEY);
      setLearningProgress(parseLearningProgress(null));
      setPrivacyMessage("Device learning progress cleared.");
    } catch {
      setPrivacyMessage("This browser blocked the learning progress change.");
    }
    setLearningClearArmed(false);
  };

  const clearQuizIdentity = () => {
    try {
      clearStoredPlayerIdentity();
      setPrivacyMessage("Saved live-quiz player name and join credentials cleared from this device.");
    } catch {
      setPrivacyMessage("This browser blocked the quiz identity change.");
    }
  };

  return (
    <div className="page-container py-8 sm:py-12">
      <section className="surface-card-elevated overflow-hidden">
        <div className="border-b border-(--border) bg-[linear-gradient(135deg,color-mix(in_srgb,var(--navy)_94%,transparent),color-mix(in_srgb,var(--navy)_78%,var(--gold)))] px-5 py-7 text-white sm:px-8 sm:py-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-(--gold) bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] font-[family-name:var(--font-editorial)] text-xl font-bold text-(--gold)">
                {initials(profile.displayName)}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-(--gold)">Your account</p>
                <h1 className="mt-1 font-[family-name:var(--font-editorial)] text-3xl font-semibold text-white sm:text-4xl">{profile.displayName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge tone="success">Signed in</StatusBadge>
                  <StatusBadge tone="warning">{profile.accountType === "public" ? "Learner" : profile.roleLabel}</StatusBadge>
                </div>
              </div>
            </div>
            <Link href="/learn" className="btn-primary self-start sm:self-auto">Continue learning</Link>
          </div>
        </div>

        <div className="grid min-h-[36rem] lg:grid-cols-[17rem_minmax(0,1fr)]">
          <nav className="border-b border-(--border) bg-(--surface) p-3 lg:border-b-0 lg:border-r lg:p-4" aria-label="Account settings">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1" role="tablist" aria-label="Account sections">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  ref={(element) => { tabRefs.current[index] = element; }}
                  id={`account-tab-${section.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeSection === section.id}
                  aria-controls={`account-panel-${section.id}`}
                  tabIndex={activeSection === section.id ? 0 : -1}
                  onClick={() => selectSection(section.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`min-w-max rounded-lg border px-3 py-2.5 text-left lg:w-full ${activeSection === section.id ? "border-(--gold) bg-[color-mix(in_srgb,var(--gold)_9%,transparent)] text-(--text)" : "border-transparent text-(--text-muted) hover:bg-(--surface-elevated) hover:text-(--text)"}`}
                >
                  <span className="block text-sm font-extrabold">{section.label}</span>
                  <span className="mt-0.5 hidden text-xs text-(--text-muted) lg:block">{section.description}</span>
                </button>
              ))}
            </div>
          </nav>

          <div className="min-w-0 bg-(--background) p-5 sm:p-7 lg:p-9">
            {activeSection === "overview" ? <OverviewPanel profile={profile} completedLessons={completedLessons} lessonCount={trackedLessonCount} totalQuizzes={totalQuizzes} /> : null}
            {activeSection === "learning" ? <LearningPanel progress={learningProgress} completedLessons={completedLessons} lessonCount={trackedLessonCount} percent={learningPercent} pathTitle={learningPathTitle} practiceQuestionCount={practiceQuestionCount} official={Boolean(officialLearning)} masteryCount={officialLearning?.mastery?.masteredAttemptCount ?? 0} /> : null}
            {activeSection === "quiz" ? <QuizPanel history={history} totalQuizzes={totalQuizzes} bestScore={bestScore} /> : null}
            {activeSection === "saved" ? <SavedPanel savedIds={savedResourceIds} resources={savedResourceOptions} /> : null}
            {activeSection === "appearance" ? <AppearancePanel /> : null}
            {activeSection === "security" ? <SecurityPanel lastLoginAt={profile.lastLoginAt} onSignedOut={() => router.replace("/login")} /> : null}
            {activeSection === "notifications" ? <NotificationsPanel /> : null}
            {activeSection === "privacy" ? (
              <PrivacyPanel
                message={privacyMessage}
                learningClearArmed={learningClearArmed}
                onClearLearning={clearLearningProgress}
                onCancelClear={() => { setLearningClearArmed(false); setPrivacyMessage(""); }}
                onClearQuizIdentity={clearQuizIdentity}
              />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Panel({ id, labelledBy, children }: { id: AccountSection; labelledBy?: string; children: React.ReactNode }) {
  return <section id={`account-panel-${id}`} role="tabpanel" aria-labelledby={labelledBy || `account-tab-${id}`} tabIndex={0}>{children}</section>;
}

function OverviewPanel({ profile, completedLessons, lessonCount, totalQuizzes }: { profile: AccountProfile; completedLessons: number; lessonCount: number; totalQuizzes: number }) {
  const fields = [
    ["Display name", profile.displayName],
    ["Email", profile.email || "Not available for this session"],
    ["Phone", profile.phone || "Not provided"],
    ["Account type", profile.accountType === "public" ? "Learner" : profile.roleLabel],
    ["Member since", formatDate(profile.createdAt)],
    ["Last sign-in", formatDate(profile.lastLoginAt, true)],
  ];
  return (
    <Panel id="overview">
      <SectionHeading eyebrow="Profile" title="Account overview" />
      <p className="max-w-2xl text-sm leading-6 text-(--text-muted)">Your authenticated profile and official learning record are account-linked. Live-quiz history remains a device summary.</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="surface-card p-4">
            <dt className="text-xs font-black uppercase tracking-[0.12em] text-(--text-muted)">{label}</dt>
            <dd className="mt-2 break-words text-sm font-bold text-(--text)">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="surface-card p-4"><strong className="editorial-heading text-3xl">{completedLessons}</strong><p className="mt-1 text-xs text-(--text-muted)">of {lessonCount} lessons completed here</p></div>
        <div className="surface-card p-4"><strong className="editorial-heading text-3xl">{totalQuizzes}</strong><p className="mt-1 text-xs text-(--text-muted)">quiz sessions recorded here</p></div>
        <div className="surface-card p-4"><strong className="editorial-heading text-3xl">1</strong><p className="mt-1 text-xs text-(--text-muted)">structured formation path available</p></div>
      </div>
    </Panel>
  );
}

function LearningPanel({ progress, completedLessons, lessonCount, percent, pathTitle, practiceQuestionCount, official, masteryCount }: { progress: LearningProgress; completedLessons: number; lessonCount: number; percent: number; pathTitle: string; practiceQuestionCount: number; official: boolean; masteryCount: number }) {
  return (
    <Panel id="learning">
      <SectionHeading eyebrow="Formation" title="Learning progress" action={official ? <StatusBadge tone="success">Account synced</StatusBadge> : <DeviceOnlyBadge />} />
      <div className="surface-card flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-6">
        <ProgressRing value={percent} label="complete" detail={`${completedLessons} of ${lessonCount} lessons`} size={126} />
        <div className="min-w-0 flex-1">
          <h3 className="editorial-heading text-2xl font-semibold">{pathTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-(--text-muted)">{official ? "Official lesson progress and mastery are loaded from your account." : "Official progress is unavailable; this view is showing device-only preview activity."}</p>
          <div className="mt-4"><ProgressBar value={percent} label="Learning path completion" /></div>
          <Link href="/learn" className="btn-primary mt-5">Open learning path</Link>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="surface-card p-4"><span className="text-xs font-black uppercase tracking-[0.12em] text-(--text-muted)">Lessons</span><strong className="editorial-heading mt-2 block text-3xl">{completedLessons}/{lessonCount}</strong></div>
        <div className="surface-card p-4"><span className="text-xs font-black uppercase tracking-[0.12em] text-(--text-muted)">{official ? "Mastered groups" : "Practice best"}</span><strong className="editorial-heading mt-2 block text-3xl">{official ? masteryCount : `${progress.practiceBest}/${practiceQuestionCount || "—"}`}</strong></div>
        <div className="surface-card p-4"><span className="text-xs font-black uppercase tracking-[0.12em] text-(--text-muted)">Device practice attempts</span><strong className="editorial-heading mt-2 block text-3xl">{progress.practiceAttempts}</strong></div>
      </div>
      <p className="mt-5 text-xs leading-5 text-(--text-muted)">Last local update: {progress.updatedAt ? formatDate(new Date(progress.updatedAt).toISOString(), true) : "No progress recorded yet"}.</p>
    </Panel>
  );
}

function QuizPanel({ history, totalQuizzes, bestScore }: { history: ReturnType<typeof useScoreHistory>["history"]; totalQuizzes: number; bestScore: number }) {
  return (
    <Panel id="quiz">
      <SectionHeading eyebrow="Competition" title="Quiz history" action={<DeviceOnlyBadge />} />
      <p className="max-w-2xl text-sm leading-6 text-(--text-muted)">These live-quiz results come from this device. They are not a global or account-wide record.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="surface-card p-5"><span className="text-xs font-black uppercase tracking-[0.12em] text-(--text-muted)">Recorded sessions</span><strong className="editorial-heading mt-2 block text-4xl">{totalQuizzes}</strong></div>
        <div className="surface-card p-5"><span className="text-xs font-black uppercase tracking-[0.12em] text-(--text-muted)">Best recorded score</span><strong className="editorial-heading mt-2 block text-4xl">{bestScore.toLocaleString()}</strong></div>
      </div>
      <div className="mt-7">
        <h3 className="editorial-heading text-xl font-semibold">Recent sessions</h3>
        {history.length === 0 ? (
          <div className="surface-card mt-3 p-6 text-center">
            <p className="font-bold">No quiz sessions recorded on this device.</p>
            <p className="mt-2 text-sm text-(--text-muted)">Join a live room to begin building your local history.</p>
            <Link href="/mobile" className="btn-primary mt-4">Join live quiz</Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.slice(0, 5).map((record, index) => (
              <li key={`${record.date}-${record.roomId}-${index}`} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-extrabold">{record.topicId || "Live quiz"}</p>
                  <p className="mt-1 text-xs text-(--text-muted)">Room {record.roomId || "unknown"} · {formatDate(record.date, true)}</p>
                </div>
                <strong className="editorial-heading text-2xl">{record.score.toLocaleString()} pts</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function SavedPanel({ savedIds, resources }: { savedIds: string[]; resources: Array<{ id: string; title: string; href: string }> }) {
  const savedResources = resources.filter((resource) => savedIds.includes(resource.id));
  return (
    <Panel id="saved">
      <SectionHeading eyebrow="Library" title="Saved items" action={<DeviceOnlyBadge />} />
      <p className="max-w-2xl text-sm leading-6 text-(--text-muted)">Library bookmarks are stored in this browser. Research Graph bookmarks are managed separately by the Graph application and are not copied into this account view.</p>
      {savedResources.length ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {savedResources.map((resource) => (
            <li key={resource.id} className="surface-card flex min-h-28 flex-col justify-between gap-4 p-4">
              <div><p className="text-xs font-black uppercase tracking-[0.12em] text-(--text-muted)">Saved resource</p><h3 className="editorial-heading mt-2 text-xl font-semibold">{resource.title}</h3></div>
              <Link href={resource.href} className="text-sm font-bold text-(--gold-hover) hover:underline">Open resource <span aria-hidden="true">→</span></Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="surface-card mt-6 p-6 text-center">
          <p className="font-bold">No saved Library items on this device.</p>
          <p className="mt-2 text-sm text-(--text-muted)">Use the bookmark control on a Library resource to keep it here.</p>
          <Link href="/library" className="btn-primary mt-4">Browse the library</Link>
        </div>
      )}
      {savedIds.length > savedResources.length ? <p className="mt-4 text-xs text-(--text-muted)">Some older bookmark identifiers no longer match the current catalogue and are hidden.</p> : null}
    </Panel>
  );
}

function AppearancePanel() {
  const { theme, preference, setPreference } = useTheme();
  const choices: Array<{ id: ThemePreference; label: string; detail: string }> = [
    { id: "light", label: "Light", detail: "Warm parchment surfaces" },
    { id: "dark", label: "Dark", detail: "Deep navy surfaces" },
    { id: "system", label: "System", detail: "Match this device" },
  ];
  return (
    <Panel id="appearance">
      <SectionHeading eyebrow="Display" title="Appearance" />
      <p className="max-w-2xl text-sm leading-6 text-(--text-muted)">Your theme preference is saved on this device. System mode follows your operating system as it changes.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            aria-pressed={preference === choice.id}
            onClick={() => setPreference(choice.id)}
            className={`surface-card min-h-32 p-5 text-left ${preference === choice.id ? "border-(--gold) ring-2 ring-[color-mix(in_srgb,var(--gold)_25%,transparent)]" : "hover:border-(--gold)"}`}
          >
            <span className="block text-lg font-extrabold">{choice.label}</span>
            <span className="mt-2 block text-sm text-(--text-muted)">{choice.detail}</span>
            {preference === choice.id ? <span className="mt-4 block text-xs font-black uppercase tracking-[0.12em] text-(--gold-hover)">Selected</span> : null}
          </button>
        ))}
      </div>
      <div className="mt-5"><Message tone="info">{`Current rendered theme: ${theme}. Preference: ${preference}.`}</Message></div>
    </Panel>
  );
}

function SecurityPanel({ lastLoginAt, onSignedOut }: { lastLoginAt: string | null; onSignedOut: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busyAction, setBusyAction] = useState<"password" | "sessions" | "logout" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  const csrfToken = async (): Promise<string> => {
    const response = await fetch("/api/auth/csrf", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { csrfToken?: string; error?: string } | null;
    if (!response.ok || !payload?.csrfToken) {
      throw new Error(response.status === 401 ? "Your session expired. Sign in again." : payload?.error || "A secure request token could not be created.");
    }
    return payload.csrfToken;
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ tone: "error", text: "New passwords do not match." });
      return;
    }
    setBusyAction("password");
    try {
      const csrf = await csrfToken();
      const response = await runWithStoredAccountSessionBoundary(() => fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      }));
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Password could not be changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ tone: "success", text: "Password changed. Other sessions are now invalid; this session remains active." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Password could not be changed." });
    } finally {
      setBusyAction(null);
    }
  };

  const revokeOtherSessions = async () => {
    setBusyAction("sessions");
    setMessage(null);
    try {
      const csrf = await csrfToken();
      const response = await runWithStoredAccountSessionBoundary(() => fetch("/api/auth/sessions/revoke", {
        method: "POST",
        headers: { "x-csrf-token": csrf },
      }));
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Other sessions could not be revoked.");
      setMessage({ tone: "success", text: "Other signed-in sessions revoked. This session remains active." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Other sessions could not be revoked." });
    } finally {
      setBusyAction(null);
    }
  };

  const signOut = async () => {
    setBusyAction("logout");
    setMessage(null);
    try {
      await runWithStoredAccountSessionBoundary(() => fetch("/api/auth/logout", { method: "POST" }));
      onSignedOut();
    } catch {
      setMessage({ tone: "error", text: "Sign out failed. Check your connection and try again." });
      setBusyAction(null);
    }
  };

  return (
    <Panel id="security">
      <SectionHeading eyebrow="Account protection" title="Security" />
      <p className="text-sm text-(--text-muted)">Last recorded sign-in: {formatDate(lastLoginAt, true)}.</p>
      {message ? <div className="mt-5"><Message tone={message.tone}>{message.text}</Message></div> : null}
      <form onSubmit={changePassword} className="surface-card mt-6 space-y-4 p-5 sm:p-6">
        <div><h3 className="editorial-heading text-xl font-semibold">Change password</h3><p className="mt-1 text-sm text-(--text-muted)">Changing your password invalidates older sessions.</p></div>
        <label className="block space-y-1.5"><span className="text-sm font-bold">Current password</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" maxLength={256} required className="form-control" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5"><span className="text-sm font-bold">New password</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={256} required className="form-control" /></label>
          <label className="block space-y-1.5"><span className="text-sm font-bold">Confirm new password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={256} required className="form-control" /></label>
        </div>
        <button type="submit" disabled={busyAction !== null || !currentPassword || newPassword.length < 8 || !confirmPassword} className="btn-primary">{busyAction === "password" ? "Changing password…" : "Change password"}</button>
      </form>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="surface-card p-5"><h3 className="editorial-heading text-xl font-semibold">Other sessions</h3><p className="mt-2 text-sm leading-6 text-(--text-muted)">Invalidate every older browser session while keeping this one active.</p><button type="button" onClick={revokeOtherSessions} disabled={busyAction !== null} className="btn-secondary mt-4">{busyAction === "sessions" ? "Revoking…" : "Revoke other sessions"}</button></div>
        <div className="surface-card p-5"><h3 className="editorial-heading text-xl font-semibold">Sign out here</h3><p className="mt-2 text-sm leading-6 text-(--text-muted)">Clear this browser’s secure session cookie.</p><button type="button" onClick={signOut} disabled={busyAction !== null} className="btn-quiet mt-4">{busyAction === "logout" ? "Signing out…" : "Sign out"}</button></div>
      </div>
    </Panel>
  );
}

function NotificationsPanel() {
  const [message, setMessage] = useState("");
  const showLatest = () => {
    window.dispatchEvent(new Event(SHOW_WHATS_NEW_EVENT));
    setMessage("Requested the latest published product update. If none opens, no release notice is currently available from the quiz service.");
  };
  return (
    <Panel id="notifications">
      <SectionHeading eyebrow="Updates" title="Notifications" />
      <p className="max-w-2xl text-sm leading-6 text-(--text-muted)">Apologia Sancta currently provides in-app product release notices. Email, push, and quiz reminder preferences are not yet supported.</p>
      <div className="surface-card mt-6 p-5 sm:p-6">
        <h3 className="editorial-heading text-xl font-semibold">What’s new</h3>
        <p className="mt-2 text-sm leading-6 text-(--text-muted)">Open the latest release summary published by the connected quiz service.</p>
        <button type="button" onClick={showLatest} className="btn-primary mt-4">Show latest update</button>
      </div>
      {message ? <div className="mt-4"><Message tone="info">{message}</Message></div> : null}
    </Panel>
  );
}

function PrivacyPanel({ message, learningClearArmed, onClearLearning, onCancelClear, onClearQuizIdentity }: { message: string; learningClearArmed: boolean; onClearLearning: () => void; onCancelClear: () => void; onClearQuizIdentity: () => void }) {
  return (
    <Panel id="privacy">
      <SectionHeading eyebrow="Device data" title="Privacy controls" />
      <p className="max-w-2xl text-sm leading-6 text-(--text-muted)">These controls affect only local browser data. They do not delete your authenticated account or server-side content.</p>
      {message ? <div className="mt-5"><Message tone="info">{message}</Message></div> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="surface-card p-5"><DeviceOnlyBadge /><h3 className="editorial-heading mt-4 text-xl font-semibold">Live-quiz identity</h3><p className="mt-2 text-sm leading-6 text-(--text-muted)">Clear the saved player name, player identifier, and active join credential from this device.</p><button type="button" onClick={onClearQuizIdentity} className="btn-secondary mt-4">Clear quiz identity</button></div>
        <div className="surface-card p-5"><DeviceOnlyBadge /><h3 className="editorial-heading mt-4 text-xl font-semibold">Learning progress</h3><p className="mt-2 text-sm leading-6 text-(--text-muted)">Permanently clear completed lessons and practice totals saved in this browser.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onClearLearning} className={learningClearArmed ? "btn-primary" : "btn-secondary"}>{learningClearArmed ? "Confirm clear progress" : "Clear learning progress"}</button>{learningClearArmed ? <button type="button" onClick={onCancelClear} className="btn-quiet">Cancel</button> : null}</div></div>
      </div>
      <p className="mt-5 text-xs leading-5 text-(--text-muted)">Recent quiz score history uses app preferences and is shown as read-only here. Account deletion and data export are not offered because no verified end-to-end workflow exists yet.</p>
    </Panel>
  );
}
