// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountDashboard } from "./AccountDashboard";
import { LEARNING_PROGRESS_KEY } from "@/lib/learningProgress";
import { LIBRARY_BOOKMARKS_KEY } from "@/lib/libraryBookmarks";
import { JOIN_TOKEN_STORAGE_KEY, USER_ID_STORAGE_KEY, USERNAME_STORAGE_KEY } from "@/lib/playerIdentity";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
const setPreference = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/hooks/useScoreHistory", () => ({
  useScoreHistory: () => ({
    history: [],
    saveSession: vi.fn(),
    totalQuizzes: 0,
    accuracy: 0,
    bestScore: 0,
  }),
}));
vi.mock("@/lib/theme", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/theme")>();
  return {
    ...original,
    useTheme: () => ({
      theme: "light",
      preference: "system",
      setPreference,
      setTheme: vi.fn(),
      toggleTheme: vi.fn(),
    }),
  };
});

const props = {
  profile: {
    displayName: "Test Learner",
    email: "learner@example.test",
    roleLabel: "Viewer",
    accountType: "public" as const,
    phone: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: "2026-07-15T18:00:00.000Z",
  },
  learningPathTitle: "Foundations of Catholic Apologetics",
  learningLessonIds: ["one", "two", "three", "four"],
  practiceQuestionCount: 8,
  savedResourceOptions: [{ id: "christology", title: "Christology", href: "/library/christology" }],
};

describe("AccountDashboard", () => {
  beforeEach(() => {
    router.replace.mockReset();
    setPreference.mockReset();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/account");
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("reports offline-safe learning progress and reads only known lessons", async () => {
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify({
      completedLessonIds: ["one", "two", "unknown"],
      practiceBest: 6,
      practiceAttempts: 3,
      updatedAt: Date.now(),
    }));

    render(<AccountDashboard {...props} initialSection="learning" />);

    expect(screen.getByRole("heading", { name: "Learning progress" })).toBeInTheDocument();
    expect(screen.getByText("Device copy safe; sync pending")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("2/4")).toBeInTheDocument());
    expect(screen.getByText("6/8")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("clears only the selected local data after explicit progress confirmation", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify({ completedLessonIds: ["one"] }));
    window.localStorage.setItem(USER_ID_STORAGE_KEY, "player-1");
    window.localStorage.setItem(USERNAME_STORAGE_KEY, "Test player");
    window.localStorage.setItem(JOIN_TOKEN_STORAGE_KEY, "join-secret");

    render(<AccountDashboard {...props} initialSection="privacy" />);

    await user.click(screen.getByRole("button", { name: "Clear quiz identity" }));
    expect(window.localStorage.getItem(USER_ID_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(USERNAME_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(JOIN_TOKEN_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEARNING_PROGRESS_KEY)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear device progress" }));
    expect(window.localStorage.getItem(LEARNING_PROGRESS_KEY)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Confirm clear device copy" }));
    expect(window.localStorage.getItem(LEARNING_PROGRESS_KEY)).toBeNull();
  });

  it("shows real device bookmarks in Saved items", async () => {
    window.localStorage.setItem(LIBRARY_BOOKMARKS_KEY, JSON.stringify(["christology"]));
    render(<AccountDashboard {...props} initialSection="saved" />);
    expect(screen.getByRole("heading", { name: "Saved items" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("link", { name: /Open resource/ })).toHaveAttribute("href", "/library/christology"));
    expect(screen.getByText("Christology")).toBeInTheDocument();
  });
});
