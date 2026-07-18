"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QuickJoinForm } from "@/components/home/QuickJoinForm";
import { InstallActions } from "@/components/home/InstallActions";
import { SHOW_WHATS_NEW_EVENT } from "@/components/releases/WhatsNewPopup";
import { ProgressBar, ProgressRing, SectionHeading, StatusBadge } from "@/components/ui/Primitives";
import { useStreak } from "@/hooks/useStreak";
import { EMPTY_LEARNING_PROGRESS, LEARNING_PROGRESS_KEY, parseLearningProgress, type LearningProgress } from "@/lib/learningProgress";
import { getEngineUrl, getResearchGraphUrl } from "@/lib/publicEnv";
import { getDailyVerse } from "@/lib/verses";
import type { Leaderboard, QuizPhase, RoomSummary } from "@/types/quiz";

type TopicSummary = { id: string; title: string; description: string; questionCount: number; tags: string[] };
type LiveState = {
  phase: QuizPhase;
  endsAtMs: number;
  questionIndex: number;
  totalQuestions: number;
  themeTitle: string;
  leaderboard?: Leaderboard;
};
type Release = { title?: string; version?: string; summary?: string };
type LearningPreview = {
  id: string;
  slug: string;
  title: string;
  estimatedMinutes?: number | null;
  difficulty?: string | null;
  previewState?: "available" | "locked" | "coming_soon" | string;
};
type OfficialProgress = {
  lessons?: Array<{ lessonId?: string; state?: string; status?: string; readingProgressPercent?: number; progressPercent?: number }>;
};

function useLiveRoom() {
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const engine = getEngineUrl();
    if (!engine) { setStatus("unavailable"); return; }
    const controller = new AbortController();
    (async () => {
      try {
        const roomsResponse = await fetch(`${engine}/rooms`, { cache: "no-store", signal: controller.signal });
        if (!roomsResponse.ok) throw new Error("rooms unavailable");
        const roomsPayload = await roomsResponse.json() as { rooms?: RoomSummary[] };
        const openRoom = roomsPayload.rooms?.find((item) => item.isActive) ?? roomsPayload.rooms?.[0] ?? null;
        setRoom(openRoom);
        if (openRoom) {
          const stateResponse = await fetch(`${engine}/state?roomId=${encodeURIComponent(openRoom.roomId)}`, { cache: "no-store", signal: controller.signal });
          if (stateResponse.ok) setState(await stateResponse.json() as LiveState);
        }
        setStatus("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("unavailable");
      }
    })();
    return () => controller.abort();
  }, []);

  return { room, state, status };
}

function useLatestRelease() {
  const [release, setRelease] = useState<Release | null>(null);
  useEffect(() => {
    const engine = getEngineUrl();
    if (!engine) return;
    const controller = new AbortController();
    fetch(`${engine}/releases/latest`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { release?: Release | null } | null) => setRelease(payload?.release ?? null))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return release;
}

function LiveQuizStrip() {
  const { room, state, status } = useLiveRoom();
  const [clockMs, setClockMs] = useState(0);
  useEffect(() => {
    const updateClock = () => setClockMs(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const liveNow = Boolean(state && clockMs > 0 && state.endsAtMs > clockMs);
  const leaders = state?.leaderboard?.topScorers?.slice(0, 3) ?? [];

  return (
    <section className="surface-card grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.55fr_1fr_auto] lg:items-center" aria-labelledby="live-quiz-heading">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={liveNow ? "success" : status === "unavailable" ? "danger" : "info"}>
            <span aria-hidden="true">●</span>{liveNow ? "Live now" : status === "loading" ? "Checking room" : status === "unavailable" ? "Engine unavailable" : "Room open"}
          </StatusBadge>
          {room ? <span className="text-xs text-(--text-muted)">{room.playerCount} {room.playerCount === 1 ? "player" : "players"}</span> : null}
        </div>
        <h2 id="live-quiz-heading" className="editorial-heading mt-2 truncate text-xl font-semibold sm:text-2xl">
          {state?.themeTitle || room?.name || (status === "unavailable" ? "Live quiz is temporarily offline" : "Waiting for room details")}
        </h2>
        <p className="mt-1 text-sm text-(--text-muted)">
          {liveNow && state ? `Round ${state.questionIndex + 1} of ${state.totalQuestions}` : room ? "The room is open; the host has not started a timed question." : "You can retry from the live quiz screen."}
        </p>
      </div>
      <div className="border-(--border) lg:border-l lg:pl-5">
        <p className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">{liveNow ? "Question closes" : "Status"}</p>
        <p className="mt-1 font-[family-name:var(--font-editorial)] text-2xl text-(--text)">
          {liveNow && state ? new Date(state.endsAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not started"}
        </p>
      </div>
      <div className="min-w-0 border-(--border) lg:border-l lg:pl-5">
        <p className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">Room leaders</p>
        {leaders.length ? (
          <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {leaders.map((leader) => <li key={`${leader.rank}-${leader.name}`} className="truncate"><span className="text-(--gold-hover)">{leader.rank}.</span> {leader.name} <span className="text-(--text-muted)">{leader.score}</span></li>)}
          </ol>
        ) : <p className="mt-2 text-sm text-(--text-muted)">No room scores yet.</p>}
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Link className="btn-primary" href={room ? `/mobile?roomId=${encodeURIComponent(room.roomId)}` : "/mobile"}>Enter room</Link>
        <Link className="btn-quiet lg:hidden" href="/leaderboard">Rankings</Link>
      </div>
    </section>
  );
}

function TopicGlyph({ index }: { index: number }) {
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-(--border) bg-(--surface-elevated) font-[family-name:var(--font-editorial)] text-xl text-(--gold-hover)" aria-hidden="true">{["✦", "☩", "◈", "✧", "⌘", "◇"][index % 6]}</span>;
}

export function HomeDashboard({ userName, topics }: { userName: string | null; topics: TopicSummary[] }) {
  const [progress, setProgress] = useState<LearningProgress>(EMPTY_LEARNING_PROGRESS);
  const [learningItems, setLearningItems] = useState<LearningPreview[]>([]);
  const [officialProgress, setOfficialProgress] = useState<OfficialProgress | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { streak } = useStreak();
  const release = useLatestRelease();
  const dailyVerse = getDailyVerse();
  const graphUrl = getResearchGraphUrl();

  useEffect(() => {
    setProgress(parseLearningProgress(localStorage.getItem(LEARNING_PROGRESS_KEY)));
    setHydrated(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadLearning = async () => {
      try {
        const previewResponse = await fetch("/api/v1/learning/progress/preview", { cache: "no-store", signal: controller.signal });
        if (previewResponse.ok) {
          const payload = await previewResponse.json() as { data?: LearningPreview[] } | LearningPreview[];
          setLearningItems(Array.isArray(payload) ? payload : payload.data ?? []);
        }
        if (userName) {
          const progressResponse = await fetch("/api/v1/learning/progress", { cache: "no-store", signal: controller.signal });
          if (progressResponse.ok) {
            const payload = await progressResponse.json() as { data?: OfficialProgress };
            setOfficialProgress(payload.data ?? null);
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") setLearningItems([]);
      }
    };
    void loadLearning();
    return () => controller.abort();
  }, [userName]);

  const officialLessons = useMemo(() => officialProgress?.lessons ?? [], [officialProgress]);
  const completedLessonIds = useMemo(() => officialLessons
    .filter((lesson) => lesson.state === "completed" || lesson.status === "completed" || Number(lesson.readingProgressPercent ?? lesson.progressPercent) >= 100)
    .map((lesson) => lesson.lessonId)
    .filter((id): id is string => Boolean(id)), [officialLessons]);
  const completion = officialLessons.length
    ? Math.round((completedLessonIds.length / officialLessons.length) * 100)
    : 0;
  const nextItem = learningItems.find((item) => !["locked", "visible_locked", "coming_soon", "hidden"].includes(item.previewState ?? "")) ?? learningItems[0] ?? null;
  const nextHref = nextItem ? `/learn/groups/${nextItem.slug}` : "/learn";
  const progressLabel = officialProgress ? "synced to your account" : "official progress begins after sign-in";

  return (
    <div className="page-container py-7 sm:py-10">
      <section className="relative grid gap-7 overflow-hidden border-b border-(--border) pb-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center" aria-labelledby="home-heading">
        <div className="relative z-10">
          <p className="eyebrow">{userName ? `Welcome back, ${userName}` : "Catholic formation and competition"}</p>
          <h1 id="home-heading" className="editorial-heading mt-3 max-w-3xl text-4xl font-semibold leading-[1.02] sm:text-5xl lg:text-[3.6rem]">
            Know the Faith.<br />Defend it with confidence.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-(--text-muted)">Build a connected understanding of Catholic truth, practise the reasons for it, and compete with charity.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={nextHref} className="btn-primary">Continue learning <span aria-hidden="true">→</span></Link>
            <Link href="/mobile" className="btn-secondary">Join live quiz</Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-(--text-muted)">
            <span><strong className="text-(--text)">{hydrated ? `${completion}%` : "—"}</strong> formation complete <span className="text-xs">{progressLabel}</span></span>
            <span><strong className="text-(--text)">{streak}</strong>-day study streak <span className="text-xs">on this device</span></span>
          </div>
        </div>
        <div className="surface-card-elevated relative p-5 sm:p-6">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-(--border) opacity-50" aria-hidden="true" />
          <p className="eyebrow">Today&apos;s focus</p>
          <div className="mt-3 flex items-start justify-between gap-5">
            <div>
              <h2 className="editorial-heading text-2xl font-semibold">{nextItem?.title ?? "Open the formation catalogue"}</h2>
              <p className="mt-1 text-sm text-(--text-muted)">{nextItem ? `Learning group${nextItem.estimatedMinutes ? ` · ${nextItem.estimatedMinutes} min` : ""}` : "Published lessons appear here as soon as staff release them."}</p>
            </div>
            <span className="text-3xl text-(--gold)" aria-hidden="true">☩</span>
          </div>
          <div className="mt-5"><ProgressBar value={completion} label="Formation completion" /></div>
          <Link href={nextHref} className="btn-primary mt-5 w-full">{nextItem ? "Open learning group" : "Browse catalogue"}</Link>
        </div>
      </section>

      <div className="mt-6"><LiveQuizStrip /></div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="journey-heading">
            <SectionHeading eyebrow="Formation" title="Continue your journey" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {learningItems.slice(0, 3).map((item, index) => {
                const locked = ["locked", "visible_locked", "coming_soon", "hidden"].includes(item.previewState ?? "");
                const current = item.id === nextItem?.id;
                return (
                  <Link key={item.id} aria-disabled={locked} href={locked ? "/learn" : `/learn/groups/${item.slug}`} className={`surface-card group p-4 transition ${locked ? "opacity-65" : "hover:-translate-y-0.5 hover:border-(--gold)"}`}>
                    <div className="flex items-start gap-3"><TopicGlyph index={index} /><div className="min-w-0"><p className="text-xs text-(--text-muted)">{locked ? "Prerequisite required" : current ? "Continue here" : "Available group"}</p><h3 className="editorial-heading mt-0.5 line-clamp-2 text-lg font-semibold">{item.title}</h3></div></div>
                    <p className="mt-3 text-sm font-bold text-(--gold-hover)">{locked ? "Locked" : current ? "Continue" : "Explore"} <span aria-hidden="true">→</span></p>
                  </Link>
                );
              })}
              {!learningItems.length ? <div className="surface-card p-5 md:col-span-2 xl:col-span-3"><p className="font-bold">No published learning groups yet.</p><p className="mt-2 text-sm text-(--text-muted)">The database-driven catalogue is ready for reviewed content.</p><Link className="btn-secondary mt-4" href="/learn">Open catalogue</Link></div> : null}
            </div>
          </section>

          <section aria-labelledby="topics-heading">
            <SectionHeading eyebrow="Library" title="Explore featured topics" action={<Link className="text-sm font-bold text-(--gold-hover) hover:underline" href="/library">View library →</Link>} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topics.slice(0, 6).map((topic, index) => (
                <Link key={topic.id} href={`/library/${topic.id}`} className="surface-card flex items-center gap-3 p-3.5 transition hover:border-(--gold)">
                  <TopicGlyph index={index + 2} />
                  <span className="min-w-0"><strong className="block truncate font-[family-name:var(--font-editorial)] text-lg font-semibold">{topic.title}</strong><span className="text-xs text-(--text-muted)">{topic.questionCount} sourced questions</span></span>
                  <span className="ml-auto text-(--gold-hover)" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="recommended-heading">
            <SectionHeading eyebrow="Recommended for you" title="Study with a purpose" />
            <div className="grid gap-4 md:grid-cols-3">
              {learningItems.filter((item) => !["locked", "visible_locked", "coming_soon", "hidden"].includes(item.previewState ?? "")).slice(1, 4).map((item, index) => (
                <Link key={item.id} href={`/learn/groups/${item.slug}`} className="surface-card p-4 hover:border-(--gold)">
                  <div className="flex items-start justify-between gap-3"><TopicGlyph index={index + 4} /><span className="text-(--text-muted)" aria-label="Bookmark available in the library">♡</span></div>
                  <h3 className="editorial-heading mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-(--text-muted)">Learning group{item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ""}{item.difficulty ? ` · ${item.difficulty}` : ""}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4" aria-label="Your dashboard">
          <section className="surface-card p-5">
            <p className="eyebrow">Daily Scripture</p>
            <blockquote className="editorial-heading mt-3 text-xl leading-7">“{dailyVerse.text.length > 150 ? `${dailyVerse.text.slice(0, 147)}…` : dailyVerse.text}”</blockquote>
            <p className="mt-3 text-sm font-bold text-(--gold-hover)">{dailyVerse.reference}</p>
          </section>
          <section className="surface-card grid place-items-center p-5 text-center">
            <ProgressRing value={completion} label="formation" detail={officialProgress ? `${completedLessonIds.length} of ${officialLessons.length} tracked lessons` : "Sign in for official progress"} size={142} />
            <div className="mt-4 grid w-full grid-cols-2 gap-2 border-t border-(--border) pt-4 text-sm">
              <div><strong className="block text-xl">{progress.practiceAttempts}</strong><span className="text-(--text-muted)">practice attempts</span></div>
              <div><strong className="block text-xl">{progress.practiceAttempts ? `${progress.practiceBest}/8` : "—"}</strong><span className="text-(--text-muted)">best practice</span></div>
            </div>
          </section>
          <section className="surface-card p-5">
            <p className="eyebrow">Quick join</p>
            <p className="mt-2 text-sm leading-6 text-(--text-muted)">Have a room code? Enter it here.</p>
            <div className="mt-3"><QuickJoinForm compact /></div>
          </section>
          <section className="surface-card p-5">
            <p className="eyebrow">Leaderboard</p>
            <p className="mt-2 text-sm leading-6 text-(--text-muted)">Daily, weekly and all-time rankings come directly from accepted live answers.</p>
            <Link className="mt-3 inline-block text-sm font-bold text-(--gold-hover) hover:underline" href="/leaderboard">View rankings →</Link>
          </section>
        </aside>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Discover more">
        {release ? <button type="button" onClick={() => window.dispatchEvent(new Event(SHOW_WHATS_NEW_EVENT))} className="surface-card p-4 text-left hover:border-(--gold)"><p className="eyebrow">What&apos;s new</p><h2 className="editorial-heading mt-2 text-lg font-semibold">{release.title || release.version || "Published update"}</h2><p className="mt-1 text-sm text-(--text-muted)">{release.summary || "Open the published release notice."}</p></button> : <div className="surface-card p-4"><p className="eyebrow">What&apos;s new</p><h2 className="editorial-heading mt-2 text-lg font-semibold">No release notice published</h2><p className="mt-1 text-sm text-(--text-muted)">The quiz service has not supplied a public update yet.</p></div>}
        {graphUrl ? <a href={graphUrl} target="_blank" rel="noopener noreferrer" className="surface-card p-4 hover:border-(--gold)"><p className="eyebrow">Research Graph</p><h2 className="editorial-heading mt-2 text-lg font-semibold">Browse connected research records</h2><p className="mt-1 text-sm text-(--text-muted)">Open the separate Apologia Graph catalogue. <span className="sr-only">Opens in a new tab.</span> ↗</p></a> : null}
        <Link href="/account?section=learning" className="surface-card p-4 hover:border-(--gold)"><p className="eyebrow">Recent achievement</p><h2 className="editorial-heading mt-2 text-lg font-semibold">{completedLessonIds.length ? `${completedLessonIds.length} lesson${completedLessonIds.length === 1 ? "" : "s"} completed` : "Your first milestone awaits"}</h2><p className="mt-1 text-sm text-(--text-muted)">{completedLessonIds.length ? "Review your device learning record." : "Complete a sourced lesson to begin your formation record."}</p></Link>
      </section>
      <section className="surface-card mt-5 p-4" aria-label="Install Apologia Sancta"><InstallActions /></section>
    </div>
  );
}
