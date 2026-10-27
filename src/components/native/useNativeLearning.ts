"use client";

import { useEffect, useState } from "react";

type LearningGroup = { id: string; slug: string; title: string; previewState?: string; estimatedMinutes?: number };
type LessonProgress = { lessonId: string; lessonSlug?: string; lessonTitle?: string; state?: string; readingProgressPercent?: number };
type LearningState = {
  groups: LearningGroup[];
  lessons: LessonProgress[];
  catalogue: "loading" | "ready" | "unavailable";
  progress: "guest" | "loading" | "ready" | "unavailable";
};

async function readData(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("Learning is temporarily unavailable");
  const payload = await response.json();
  return payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
}

export function useNativeLearning(signedIn: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LearningState>({ groups: [], lessons: [], catalogue: "loading", progress: signedIn ? "loading" : "guest" });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setState({ groups: [], lessons: [], catalogue: "loading", progress: signedIn ? "loading" : "guest" });

    const catalogue = readData("/api/v1/learning/progress/preview", controller.signal)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Invalid catalogue");
        const groups = data.filter((item): item is LearningGroup => Boolean(item && typeof item.id === "string" && typeof item.slug === "string" && typeof item.title === "string"));
        if (active) setState((current) => ({ ...current, groups, catalogue: "ready" }));
      })
      .catch(() => { if (active) setState((current) => ({ ...current, catalogue: "unavailable" })); });

    const progress = signedIn ? readData("/api/v1/learning/progress", controller.signal)
      .then((data) => {
        if (!data || typeof data !== "object" || !("lessons" in data) || !Array.isArray(data.lessons)) throw new Error("Invalid progress");
        const lessons = data.lessons.filter((item): item is LessonProgress => Boolean(item && typeof item.lessonId === "string"));
        if (active) setState((current) => ({ ...current, lessons, progress: "ready" }));
      })
      .catch(() => { if (active) setState((current) => ({ ...current, progress: "unavailable" })); }) : Promise.resolve();

    void Promise.allSettled([catalogue, progress]).then(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [signedIn, attempt]);

  const completed = state.lessons.filter((lesson) => lesson.state === "completed" || Number(lesson.readingProgressPercent) >= 100);
  // The server returns the most recently active lesson first. Resume that
  // published lesson rather than sending every returning learner to group one.
  const resume = state.lessons.find((lesson) => lesson.lessonSlug && lesson.state !== "completed" && Number(lesson.readingProgressPercent ?? 0) < 100 && (lesson.state === "in_progress" || Number(lesson.readingProgressPercent) > 0));
  const nextGroup = state.groups.find((group) => !["locked", "visible_locked", "coming_soon", "hidden"].includes(group.previewState ?? ""));

  return { ...state, completedCount: completed.length, resume, nextGroup, retry: () => setAttempt((value) => value + 1) };
}
