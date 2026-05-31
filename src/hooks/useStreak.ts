"use client";

import { useEffect, useState } from "react";
import { prefGet, prefSet } from "@/lib/native";

const STREAK_KEY = "streak_count";
const LAST_OPEN_KEY = "streak_last_open";

export interface StreakState {
  streak: number;
  isNewDay: boolean; // true on the first load of a new calendar day
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function useStreak(): StreakState {
  const [state, setState] = useState<StreakState>({ streak: 0, isNewDay: false });

  useEffect(() => {
    async function update() {
      const today = todayDateString();
      const lastOpen = await prefGet(LAST_OPEN_KEY);
      const storedStreak = parseInt((await prefGet(STREAK_KEY)) ?? "0", 10);

      if (lastOpen === today) {
        // Already opened today — just return current streak
        setState({ streak: storedStreak, isNewDay: false });
        return;
      }

      // Check if yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const newStreak = lastOpen === yesterdayStr ? storedStreak + 1 : 1;

      await prefSet(STREAK_KEY, String(newStreak));
      await prefSet(LAST_OPEN_KEY, today);
      setState({ streak: newStreak, isNewDay: true });
    }

    void update();
  }, []);

  return state;
}
