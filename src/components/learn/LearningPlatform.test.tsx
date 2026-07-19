// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LessonBookmarkControl } from "./LearningPlatform";

const LESSON_ID = "11111111-1111-4111-8111-111111111111";
const BOOKMARK_ID = "22222222-2222-4222-8222-222222222222";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
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
});
