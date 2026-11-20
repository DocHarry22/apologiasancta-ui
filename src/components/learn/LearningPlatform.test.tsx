// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatabaseLesson, LearningCatalogue, LessonBookmarkControl } from "./LearningPlatform";
import { LEARNER_API_READ_TIMEOUT_MS, LEARNER_API_WRITE_TIMEOUT_MS } from "@/lib/fetchWithTimeout";

const LESSON_ID = "11111111-1111-4111-8111-111111111111";
const BOOKMARK_ID = "22222222-2222-4222-8222-222222222222";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("learning catalogue deadline", () => {
  it("offers retry instead of loading forever when the catalogue read hangs", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
        },
      });
      return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "application/json" } }));
    }));

    render(<LearningCatalogue />);
    expect(screen.getByLabelText("Loading learning content")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(LEARNER_API_READ_TIMEOUT_MS); });

    expect(screen.getByRole("alert")).toHaveTextContent("did not respond in time");
    expect(screen.getByRole("button", { name: "Try live catalogue again" })).toBeEnabled();
    expect(screen.getByRole("link", { name: /Scripture, Tradition, and the Magisterium/i })).toHaveAttribute("href", "/learn/scripture-tradition-magisterium");
    expect(screen.getByRole("link", { name: /The Real Presence in the Eucharist/i })).toHaveAttribute("href", "/learn/real-presence-eucharist");
    expect(screen.getByLabelText("Bundled Foundations lessons")).toBeInTheDocument();
  });

  it("filters the bundled fallback and clears filters after a catalogue failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "Learning service unavailable" }, 503)));
    const user = userEvent.setup();
    render(<LearningCatalogue />);

    expect(await screen.findByLabelText("Bundled Foundations lessons")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search programmes" }), "Eucharist");
    expect(screen.getByRole("link", { name: /The Real Presence in the Eucharist/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Scripture, Tradition, and the Magisterium/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Coming soon" }));
    expect(screen.getByText("No bundled lesson matches these filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Bundled Foundations lessons")).toBeInTheDocument();
  });
});

describe("bundled lesson outage fallback", () => {
  it("renders the full sourced bundled lesson when the live lesson is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "Learning service unavailable" }, 503)));
    render(<DatabaseLesson slug="scripture-tradition-magisterium" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Scripture, Tradition, and the Magisterium" })).toBeInTheDocument();
    expect(screen.getByText("Bundled formation lesson")).toBeInTheDocument();
    expect(screen.getByText("Common objection")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /2 Thessalonians 2:15/i })).toHaveAttribute("href", "https://bible.usccb.org/bible/2thessalonians/2");
    expect(screen.getByRole("link", { name: /Next lesson/i })).toHaveAttribute("href", "/learn/real-presence-eucharist");
  });

  it("keeps the generic unavailable state for an unknown lesson slug", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "Learning service unavailable" }, 503)));
    render(<DatabaseLesson slug="not-a-bundled-lesson" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t load this lesson.");
    expect(screen.queryByText("Bundled formation lesson")).not.toBeInTheDocument();
  });
});

describe("LessonBookmarkControl", () => {
  it("saves and precisely removes an account-linked lesson bookmark", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      if (url === "/api/v1/learning/bookmarks?limit=100&offset=0" && method === "GET") {
        return jsonResponse({ data: [], meta: { hasMore: false } });
      }
      if (url === "/api/auth/csrf" && method === "GET") {
        return jsonResponse({ csrfToken: "test-csrf-token" });
      }
      if (url === "/api/v1/learning/bookmarks" && method === "POST") {
        return jsonResponse({ data: { id: BOOKMARK_ID, lessonId: LESSON_ID, sectionId: null } }, 201);
      }
      if (url === `/api/v1/learning/bookmarks?id=${BOOKMARK_ID}` && method === "DELETE") {
        return jsonResponse({ data: { deleted: true } });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    const user = userEvent.setup();

    render(<LessonBookmarkControl lessonId={LESSON_ID} lessonTitle="The lesson title" />);

    await user.click(await screen.findByRole("button", { name: "Bookmark lesson" }));
    expect(await screen.findByRole("button", { name: "Remove bookmark" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Lesson bookmarked to your account.");

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      lessonId: LESSON_ID,
      sectionId: null,
      label: "The lesson title",
      note: null,
    });

    await user.click(screen.getByRole("button", { name: "Remove bookmark" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Bookmark lesson" })).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByRole("status")).toHaveTextContent("Bookmark removed.");
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/learning/bookmarks?id=${BOOKMARK_ID}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("stops a stalled bookmark save and warns that its outcome is unknown", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      if (url === "/api/v1/learning/bookmarks?limit=100&offset=0" && method === "GET") {
        return jsonResponse({ data: [], meta: { hasMore: false } });
      }
      if (url === "/api/auth/csrf" && method === "GET") {
        return jsonResponse({ csrfToken: "test-csrf-token" });
      }
      if (url === "/api/v1/learning/bookmarks" && method === "POST") {
        const body = new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
          },
        });
        return new Response(body, { status: 201, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    render(<LessonBookmarkControl lessonId={LESSON_ID} lessonTitle="The lesson title" />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Bookmark lesson" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await act(async () => { await vi.advanceTimersByTimeAsync(LEARNER_API_WRITE_TIMEOUT_MS); });

    expect(screen.getByRole("alert")).toHaveTextContent("did not confirm whether that change finished");
    expect(screen.getByRole("alert")).toHaveTextContent("Refresh this page before trying again");
    expect(screen.getByRole("button", { name: "Bookmark lesson" })).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
});
