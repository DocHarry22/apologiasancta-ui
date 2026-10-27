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
    vi.restoreAllMocks();
  });

  it("reports learning progress as device-only and reads only known lessons", async () => {
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify({
      completedLessonIds: ["one", "two", "unknown"],
      practiceBest: 6,
      practiceAttempts: 3,
      updatedAt: Date.now(),
    }));

    render(<AccountDashboard {...props} initialSection="learning" />);

    expect(screen.getByRole("heading", { name: "Learning progress" })).toBeInTheDocument();
    expect(screen.getByText("Saved only on this device")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Clear learning progress" }));
    expect(window.localStorage.getItem(LEARNING_PROGRESS_KEY)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Confirm clear progress" }));
    expect(window.localStorage.getItem(LEARNING_PROGRESS_KEY)).toBeNull();
  });

  it("shows real device bookmarks in Saved items", async () => {
    window.localStorage.setItem(LIBRARY_BOOKMARKS_KEY, JSON.stringify(["christology"]));
    render(<AccountDashboard {...props} initialSection="saved" />);
    expect(screen.getByRole("heading", { name: "Saved items" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("link", { name: /Open resource/ })).toHaveAttribute("href", "/library/christology"));
    expect(screen.getByText("Christology")).toBeInTheDocument();
  });

  it("keeps account sections keyboard accessible and puts deletion in Privacy", async () => {
    const user = userEvent.setup();
    render(<AccountDashboard {...props} initialSection="overview" />);
    expect(screen.queryByRole("link", { name: "Delete account" })).not.toBeInTheDocument();
    const overview = screen.getByRole("tab", { name: "Overview" });
    overview.focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(screen.getByRole("tab", { name: "Learning" })).toHaveFocus());
    expect(window.location.search).toBe("?section=learning");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Privacy" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Delete account" })).toHaveAttribute("href", "/account/delete");
    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    await user.click(screen.getByRole("button", { name: /Dark Deep navy surfaces/ }));
    expect(setPreference).toHaveBeenCalledWith("dark");
  });

  it("shows confirmed lesson counts and real saved totals without inventing paths", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { lessons: [{ lessonId: "one", state: "completed" }, { lessonId: "two", state: "in_progress" }] } })));
    window.localStorage.setItem(LIBRARY_BOOKMARKS_KEY, JSON.stringify(["christology"]));
    render(<AccountDashboard {...props} initialSection="overview" />);
    await waitFor(() => expect(screen.getAllByText("1")).toHaveLength(2));
    expect(screen.getByText("Lessons completed")).toBeInTheDocument();
    expect(screen.getByText("Saved collections · this device")).toBeInTheDocument();
    expect(screen.queryByText("structured formation path available")).not.toBeInTheDocument();
  });

  it("preserves the CSRF-protected password change and reports its outcome", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input) === "/api/auth/csrf") return new Response(JSON.stringify({ csrfToken: "test-csrf" }));
      if (init?.method === "PATCH") return new Response(JSON.stringify({ ok: true }));
      return new Response(JSON.stringify({ data: { lessons: [] } }));
    });
    const user = userEvent.setup();
    render(<AccountDashboard {...props} initialSection="security" />);
    await user.type(screen.getByLabelText("Current password"), "old-password");
    await user.type(screen.getByLabelText("New password", { exact: true }), "new-password-2026");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password-2026");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Password changed.");
    const call = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(call?.[0]).toBe("/api/auth/password");
    expect(call?.[1]?.headers).toMatchObject({ "x-csrf-token": "test-csrf" });
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ currentPassword: "old-password", newPassword: "new-password-2026", confirmPassword: "new-password-2026" });
  });
});
