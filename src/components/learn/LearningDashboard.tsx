"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProgressBar, ProgressRing, SectionHeading, StatusBadge } from "@/components/ui/Primitives";
import { useStreak } from "@/hooks/useStreak";
import { learningPath } from "@/lib/learningContent";
import { EMPTY_LEARNING_PROGRESS, type LearningProgress } from "@/lib/learningProgress";
import {
  LEARNING_PROGRESS_CHANGED_EVENT,
  readLocalLearningProgress,
  syncLocalLearningProgress,
  type LearningProgressSyncStatus,
} from "@/lib/learningProgressSync";

type TopicSummary = { id: string; title: string; questionCount: number };

const stageLabels = [
  { title: "Foundations", subtitle: "Revelation & authority" },
  { title: "Sacred Scripture", subtitle: "Christ & the sacraments" },
  { title: "The Church", subtitle: "Apostles & succession" },
  { title: "Christian Life", subtitle: "Grace & discipleship" },
];

function TopicIcon({ index }: { index: number }) {
  return <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-(--border) bg-(--surface-elevated) font-[family-name:var(--font-editorial)] text-2xl text-(--gold-hover)" aria-hidden="true">{["☩", "△", "▥", "♢", "⌂", "⚖"][index % 6]}</span>;
}

export function LearningDashboard({ topics, authenticated }: { topics: TopicSummary[]; authenticated: boolean }) {
  const [progress, setProgress] = useState<LearningProgress>(EMPTY_LEARNING_PROGRESS);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<LearningProgressSyncStatus>(authenticated ? "local_only" : "signed_out");
  const { streak } = useStreak();

  useEffect(() => {
    setProgress(readLocalLearningProgress());
    setHydrated(true);
    const refresh = () => setProgress(readLocalLearningProgress());
    const sync = () => {
      if (!authenticated) return;
      void syncLocalLearningProgress().then((outcome) => {
        setProgress(outcome.progress);
        setSyncStatus(outcome.status);
      });
    };
    window.addEventListener(LEARNING_PROGRESS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("online", sync);
    sync();
    return () => {
      window.removeEventListener(LEARNING_PROGRESS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("online", sync);
    };
  }, [authenticated]);

  const completedLessonIds = useMemo(() => {
    const known = new Set(learningPath.lessons.map((lesson) => lesson.id));
    return [...new Set(progress.completedLessonIds)].filter((id) => known.has(id));
  }, [progress.completedLessonIds]);
  const nextLesson = useMemo(() => learningPath.lessons.find((lesson) => !completedLessonIds.includes(lesson.id)) ?? learningPath.lessons.at(-1)!, [completedLessonIds]);
  const completed = completedLessonIds.length;
  const completion = hydrated ? Math.round((completed / learningPath.lessons.length) * 100) : 0;
  const practiceMastery = progress.practiceAttempts ? Math.round((progress.practiceBest / 8) * 100) : 0;

  return (
    <div className="page-container py-8 sm:py-11">
      <section className="relative grid gap-7 overflow-hidden border-b border-(--border) pb-8 lg:grid-cols-[1fr_auto] lg:items-center" aria-labelledby="learn-heading">
        <div>
          <p className="eyebrow">Formation path</p>
          <h1 id="learn-heading" className="editorial-heading mt-2 max-w-2xl text-4xl font-semibold leading-[1.05] sm:text-5xl">Learn the Faith,<br />step by step.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-(--text-muted)">Build a clear, connected understanding of Scripture, doctrine, worship, and Catholic life.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" href={`/learn/${nextLesson.id}`}>{completed ? "Continue learning" : "Begin the path"}</Link>
            <a className="btn-secondary" href="#learning-plan">View learning plan</a>
          </div>
          <p className="mt-3 text-xs text-(--text-muted)">{!authenticated
            ? "Sign in is optional. Progress stays available on this device."
            : syncStatus === "synced"
              ? "Account progress is synced; offline changes will retry automatically."
              : "Progress is safe on this device. Cloud sync will retry when available."}</p>
        </div>
        <div className="flex items-center justify-center gap-5 lg:pr-12">
          <ProgressRing value={completion} label="complete" detail={`${completed} of ${learningPath.lessons.length} lessons`} size={164} />
        </div>
      </section>

      <section className="surface-card mt-6 grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_0.75fr_auto] lg:items-center" aria-labelledby="current-course-heading">
        <div className="flex items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-(--border) bg-(--surface-elevated) text-3xl text-(--gold)" aria-hidden="true">☩</span>
          <div><p className="eyebrow">Continue your path</p><h2 id="current-course-heading" className="editorial-heading mt-1 text-2xl font-semibold">{nextLesson.title}</h2><p className="mt-1 text-sm text-(--text-muted)">{nextLesson.subtitle}</p></div>
        </div>
        <div className="border-(--border) lg:border-x lg:px-6">
          <div className="flex justify-between gap-4 text-sm"><span className="text-(--text-muted)">Your progress</span><strong>{completion}%</strong></div>
          <div className="mt-2"><ProgressBar value={completion} label="Learning path progress" /></div>
          <p className="mt-2 text-xs text-(--text-muted)">Next: {nextLesson.title} · {nextLesson.durationMinutes} min</p>
        </div>
        <Link href={`/learn/${nextLesson.id}`} className="btn-primary">Resume lesson <span aria-hidden="true">→</span></Link>
      </section>

      <section id="learning-plan" className="mt-7 scroll-mt-28" aria-labelledby="learning-plan-heading">
        <SectionHeading eyebrow="Your learning path" title="A connected formation journey" />
        <ol className="relative grid gap-3 md:grid-cols-4 before:absolute before:left-[12%] before:right-[12%] before:top-6 before:hidden before:h-px before:bg-(--gold) md:before:block">
          {learningPath.lessons.map((lesson, index) => {
            const isCompleted = completedLessonIds.includes(lesson.id);
            const isCurrent = lesson.id === nextLesson.id;
            const currentLessonIndex = learningPath.lessons.findIndex((item) => item.id === nextLesson.id);
            const unlocked = isCompleted || index <= currentLessonIndex;
            const cardClass = `surface-card block h-full p-4 text-center ${isCurrent ? "border-(--gold)" : ""} ${unlocked ? "hover:border-(--gold)" : "opacity-65"}`;
            const cardContent = <>
              <span className={`relative z-10 mx-auto grid h-10 w-10 place-items-center rounded-full border font-[family-name:var(--font-editorial)] font-bold ${isCompleted ? "border-(--blue) bg-(--blue) text-white" : isCurrent ? "border-(--gold) bg-(--gold) text-(--button-primary-text)" : "border-(--border) bg-(--surface-elevated) text-(--text-muted)"}`} aria-hidden="true">{isCompleted ? "✓" : unlocked ? index + 1 : "⌑"}</span>
              <h3 className="editorial-heading mt-3 text-lg font-semibold">{stageLabels[index].title}</h3>
              <p className="mt-1 text-xs text-(--text-muted)">{stageLabels[index].subtitle}</p>
              <p className="mt-3 text-xs font-bold text-(--text-muted)">{isCompleted ? "1 / 1 lesson" : unlocked ? "0 / 1 lesson" : "Locked"}</p>
              <div className="mt-3"><ProgressBar value={isCompleted ? 100 : 0} label={`${stageLabels[index].title} progress`} /></div>
            </>;
            return (
              <li key={lesson.id} className="relative">
                {unlocked
                  ? <Link href={`/learn/${lesson.id}`} className={cardClass}>{cardContent}</Link>
                  : <div className={cardClass} aria-label={`${stageLabels[index].title}, locked`}>{cardContent}</div>}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-7 grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.95fr_0.78fr]">
        <section className="surface-card p-5" aria-labelledby="recommended-next-heading">
          <SectionHeading eyebrow="Recommended next" title="Keep the thread connected" />
          <div className="space-y-2">
            {learningPath.lessons.filter((lesson) => lesson.id === nextLesson.id && !completedLessonIds.includes(lesson.id)).map((lesson, index) => (
              <Link key={lesson.id} href={`/learn/${lesson.id}`} className="flex min-h-16 items-center gap-3 rounded-lg border border-(--border) p-3 hover:border-(--gold)">
                <TopicIcon index={index} />
                <span className="min-w-0 flex-1"><strong className="block truncate font-[family-name:var(--font-editorial)]">{lesson.title}</strong><span className="text-xs text-(--text-muted)">{lesson.difficulty} · {lesson.durationMinutes} min</span></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
            {completed === learningPath.lessons.length ? <Link href="/practice" className="btn-secondary w-full">Review with practice</Link> : null}
          </div>
        </section>

        <section className="surface-card p-5" aria-labelledby="explore-topic-heading">
          <SectionHeading eyebrow="Explore by topic" title="Follow your questions" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {topics.slice(0, 6).map((topic, index) => (
              <Link key={topic.id} href={`/library/${topic.id}`} className="rounded-lg border border-(--border) p-3 text-center hover:border-(--gold)">
                <TopicIcon index={index} /><strong className="mt-2 block truncate font-[family-name:var(--font-editorial)] text-sm">{topic.title}</strong><span className="text-[0.7rem] text-(--text-muted)">{topic.questionCount} questions</span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="space-y-4" aria-label="Progress tools">
          <section className="surface-card p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Study streak</p><p className="editorial-heading mt-2 text-3xl font-semibold">{streak} <span className="text-sm font-normal text-(--text-muted)">days</span></p></div><span className="text-2xl text-(--gold)" aria-hidden="true">◆</span></div><p className="mt-2 text-xs text-(--text-muted)">Based on daily use of this device.</p></section>
          <section className="surface-card p-5"><p className="eyebrow">Practice mastery</p><div className="mt-3"><ProgressBar value={practiceMastery} label="Best practice mastery" /></div><p className="mt-2 text-sm"><strong>{progress.practiceAttempts ? `${practiceMastery}%` : "Not measured"}</strong> <span className="text-(--text-muted)">from {progress.practiceAttempts} attempt{progress.practiceAttempts === 1 ? "" : "s"}</span></p></section>
          <section className="surface-card p-5"><p className="eyebrow">Daily review</p><p className="mt-2 text-sm text-(--text-muted)">Use the sourced practice set to reinforce explanations.</p><Link href="/practice" className="btn-primary mt-3 w-full">Review now</Link></section>
        </aside>
      </div>

      <section className="surface-card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Recent achievement">
        <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full border border-(--gold) text-xl text-(--gold)" aria-hidden="true">✦</span><div><p className="eyebrow">Recent achievement</p><p className="editorial-heading mt-1 text-lg font-semibold">{completed ? `${completed} formation lesson${completed === 1 ? "" : "s"} completed` : "Begin the Foundations path"}</p></div></div>
        <StatusBadge tone={completed ? "success" : "neutral"}>{completed ? (syncStatus === "synced" ? "Synced to your account" : "Saved on this device") : "Not yet earned"}</StatusBadge>
      </section>
    </div>
  );
}
