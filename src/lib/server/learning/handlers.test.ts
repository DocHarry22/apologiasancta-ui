import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ searchPublishedContent: vi.fn() }));

vi.mock("./publicRepository", async (importOriginal) => ({
  ...await importOriginal<typeof import("./publicRepository")>(),
  searchPublishedContent: mocks.searchPublishedContent,
}));

import { searchRoute } from "./handlers";

describe("learning search route", () => {
  it("accepts source as a public search content type", async () => {
    mocks.searchPublishedContent.mockResolvedValueOnce({ data: [], total: 0 });

    const response = await searchRoute(new NextRequest("http://localhost/api/v1/learning/search?q=catechism&type=source"));

    expect(response.status).toBe(200);
    expect(mocks.searchPublishedContent).toHaveBeenCalledWith(expect.objectContaining({
      query: "catechism",
      contentType: "source",
    }));
  });
});
