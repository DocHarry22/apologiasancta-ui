// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CapacitorRedirect } from "./CapacitorRedirect";
import { NativeBottomTabs } from "./NativeBottomTabs";
import { NativeHomeDashboard } from "./NativeHomeDashboard";
import { MobileBottomNavigation } from "@/components/shell/MobileBottomNavigation";

const environment = vi.hoisted(() => ({ native: false, pathname: "/native", push: vi.fn(), replace: vi.fn(), enterQuiz: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => environment.pathname, useRouter: () => ({ push: environment.push, replace: environment.replace }) }));
vi.mock("@/lib/native", () => ({ isNativePlatform: () => environment.native }));
vi.mock("@/hooks/useQuizEntryGate", () => ({ useQuizEntryGate: () => ({ requestQuizEntry: environment.enterQuiz, onboardingModals: null }) }));
vi.mock("@/components/ui/ThemeToggle", () => ({ ThemeToggle: () => <button aria-label="Switch to dark mode" /> }));

const topics = [{ id: "scripture", title: "Sacred Scripture", questionCount: 12 }];
const verse = { text: "Your word is a lamp for my feet, a light on my path.", reference: "Psalm 119:105" };
const group = { id: "group-1", title: "Understanding the Creed", slug: "the-creed", previewState: "unlocked" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });

describe("Android home and navigation", () => {
  beforeEach(() => {
    environment.native = false;
    environment.pathname = "/native";
    environment.push.mockClear();
    environment.replace.mockClear();
    environment.enterQuiz.mockClear();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("redirects only the Android website entry point and preserves deep links", () => {
    environment.native = true;
    environment.pathname = "/";
    const view = render(<CapacitorRedirect />);
    expect(environment.replace).toHaveBeenCalledExactlyOnceWith("/native");
    environment.replace.mockClear();
    for (const pathname of ["/learn", "/learn/the-creed/", "/library/scripture/", "/account", "/research"]) {
      environment.pathname = pathname;
      view.rerender(<CapacitorRedirect />);
    }
    expect(environment.replace).not.toHaveBeenCalled();
    environment.native = false;
    environment.pathname = "/";
    view.rerender(<CapacitorRedirect />);
    expect(environment.replace).not.toHaveBeenCalled();
  });

  it("renders one bottom navigation on Android and marks the active quiz button", async () => {
    environment.native = true;
    environment.pathname = "/mobile/";
    render(<><MobileBottomNavigation /><NativeBottomTabs /></>);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Open quiz" })).toHaveAttribute("aria-current", "page");
    await userEvent.setup().click(screen.getByRole("button", { name: "Open quiz" }));
    expect(environment.enterQuiz).toHaveBeenCalledOnce();
  });

  it("preserves mobile website navigation", () => {
    environment.pathname = "/learn/groups/the-creed/";
    render(<MobileBottomNavigation />);
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute("aria-current", "page");
  });

  it("offers a guest an accessible learning group and keeps locked groups out of the hero", async () => {
    const fetcher = vi.fn().mockResolvedValue(json([{ ...group, id: "locked", slug: "locked", title: "Locked group", previewState: "visible_locked" }, group]));
    vi.stubGlobal("fetch", fetcher);
    render(<NativeHomeDashboard userName={null} topics={topics} verse={verse} />);
    expect(await screen.findByRole("link", { name: "Start learning" })).toHaveAttribute("href", "/learn/groups/the-creed");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Locked group")).not.toBeInTheDocument();
    expect(screen.getByText("Sign in to track lessons")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sacred scripture/i })).toHaveAttribute("href", "/library/scripture");
    expect(screen.getByText(verse.reference)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /install/i })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /find a room/i }));
    expect(environment.enterQuiz).toHaveBeenCalledOnce();
  });

  it("resumes the most recent unfinished lesson using confirmed account progress", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/preview") ? json([group]) : json({ lessons: [
      { lessonId: "done", lessonSlug: "completed", state: "completed", readingProgressPercent: 100 },
      { lessonId: "resume", lessonSlug: "why-we-believe", lessonTitle: "Why we believe", state: "in_progress", readingProgressPercent: 35 },
    ] })));
    render(<NativeHomeDashboard userName="Ada Lovelace" topics={topics} verse={verse} />);
    expect(await screen.findByRole("link", { name: "Continue lesson" })).toHaveAttribute("href", "/learn/why-we-believe");
    expect(screen.getByText("Why we believe")).toBeInTheDocument();
    expect(screen.getByText("Welcome back, Ada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1 Lessons completed" })).toHaveAttribute("href", "/account?section=learning");
    expect(screen.queryByText(/formation complete/i)).not.toBeInTheDocument();
  });

  it("recovers from an unavailable catalogue without hiding other actions", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(null, 503)).mockResolvedValueOnce(json([group]));
    vi.stubGlobal("fetch", fetcher);
    render(<NativeHomeDashboard userName={null} topics={[]} verse={verse} />);
    expect(await screen.findByRole("status")).toHaveTextContent("We couldn’t load your next lesson.");
    expect(screen.getByRole("link", { name: "Explore lessons" })).toHaveAttribute("href", "/learn");
    expect(screen.getByRole("link", { name: /explore the library/i })).toHaveAttribute("href", "/library");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "Start learning" })).toHaveAttribute("href", "/learn/groups/the-creed");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps available learning usable when account progress fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/preview") ? json([group]) : json(null, 503)));
    render(<NativeHomeDashboard userName="Ada" topics={topics} verse={verse} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Your saved progress couldn’t load.");
    expect(screen.getByRole("link", { name: "Start learning" })).toHaveAttribute("href", "/learn/groups/the-creed");
    expect(screen.getByRole("link", { name: "— Lessons completed" })).toBeInTheDocument();
  });

  it("does not link a locked group when no accessible groups exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([{ ...group, previewState: "visible_locked" }])));
    render(<NativeHomeDashboard userName={null} topics={topics} verse={verse} />);
    await waitFor(() => expect(screen.queryByText("Finding your next step…")).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Explore lessons" })).toHaveAttribute("href", "/learn");
    expect(screen.queryByText(group.title)).not.toBeInTheDocument();
  });
});
