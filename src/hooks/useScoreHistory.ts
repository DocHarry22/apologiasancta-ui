"use client";

import { useCallback, useEffect, useState } from "react";
import { prefGet, prefSet } from "@/lib/native";

const HISTORY_KEY = "quiz_score_history";
const MAX_ENTRIES = 50;

export interface QuizSessionRecord {
  date: string;       // ISO timestamp
  roomId: string;
  topicId: string;
  score: number;
  correct: number;
  total: number;
}

export function useScoreHistory() {
  const [history, setHistory] = useState<QuizSessionRecord[]>([]);

  useEffect(() => {
    prefGet(HISTORY_KEY).then((raw) => {
      if (raw) {
        try { setHistory(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
  }, []);

  const saveSession = useCallback(async (record: QuizSessionRecord) => {
    const next = [record, ...history].slice(0, MAX_ENTRIES);
    setHistory(next);
    await prefSet(HISTORY_KEY, JSON.stringify(next));
  }, [history]);

  const totalQuizzes = history.length;
  const totalCorrect = history.reduce((s, r) => s + r.correct, 0);
  const totalAnswered = history.reduce((s, r) => s + r.total, 0);
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const bestScore = history.reduce((b, r) => Math.max(b, r.score), 0);

  return { history, saveSession, totalQuizzes, accuracy, bestScore };
}
