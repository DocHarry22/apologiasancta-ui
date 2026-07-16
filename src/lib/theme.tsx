"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

interface ThemeContextType {
  theme: Theme;
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "apologia-sancta-theme";

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors (private mode / blocked storage)
  }
}

function isPreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = safeStorageGet(STORAGE_KEY);
    const initialPreference = isPreference(stored) ? stored : "system";
    const inlinePreference = document.documentElement.dataset.themePreference;
    const resolvedPreference = isPreference(inlinePreference) ? inlinePreference : initialPreference;
    setPreferenceState(resolvedPreference);
    setThemeState(resolveTheme(resolvedPreference));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const nextTheme = resolveTheme(preference);
      setThemeState(nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
      document.documentElement.dataset.themePreference = preference;
      document.getElementById("apologia-theme-color")?.setAttribute(
        "content",
        nextTheme === "dark" ? "#081B29" : "#F7F2E8"
      );
    };
    apply();
    if (preference === "system") media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  const setPreference = (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    safeStorageSet(STORAGE_KEY, nextPreference);
  };

  const toggleTheme = () => {
    setPreference(theme === "dark" ? "light" : "dark");
  };

  const setTheme = (newTheme: Theme) => {
    setPreference(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
