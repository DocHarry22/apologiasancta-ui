import { describe, expect, it } from "vitest";
import { graphAppDestination, graphAppHref, graphFrameHref, graphNavigationParams, graphOrigin, graphWebsiteHref } from "./graphEmbed";

describe("live Graph navigation", () => {
  it("opens the actual configured website in 3D and preserves canonical navigation", () => {
    const href = graphFrameHref("https://graph.test", "record=creed&focus=claim%3Acreed&lens=historical&depth=3", "https://learner.test");
    const url = new URL(href!);
    expect(url.origin).toBe("https://graph.test");
    expect(url.pathname).toBe("/graph/creed");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ focus: "claim:creed", lens: "historical", depth: "3", view: "3d", embed: "android", appOrigin: "https://learner.test" });
  });
  it("restores compatibility paths and the explicit 2D view inside Android", () => {
    const trail = [{ id: "display-1", title: "First" }, { id: "display-2", title: "Second" }];
    const href = graphAppHref(`https://graph.test/graph/creed?compatibility=1&view=2d&focus=display-2&trail=${encodeURIComponent(JSON.stringify(trail))}`, "https://graph.test");
    const params = new URL(href!, "https://learner.test").searchParams;
    expect(params.get("record")).toBe("creed");
    expect(params.get("view")).toBe("2d");
    expect(params.get("compatibility")).toBe("1");
    expect(JSON.parse(params.get("trail")!)).toEqual(trail);
  });
  it("rejects foreign destinations and unsafe configured addresses", () => {
    for (const href of ["https://evil.test/graph", "javascript:alert(1)", "https://graph.test/admin", "https://user:password@graph.test/graph"]) expect(graphAppHref(href, "https://graph.test")).toBeNull();
    for (const base of ["http://graph.test", "javascript:alert(1)", "https://user:password@graph.test"]) expect(graphOrigin(base)).toBeNull();
    expect(graphOrigin("http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
  });
  it("bounds navigation metadata and removes non-navigation query parameters", () => {
    const params = graphNavigationParams(new URLSearchParams({ record: "../../admin", focus: "x".repeat(201), depth: "99", lens: "unknown", token: "secret", trail: JSON.stringify(Array(121).fill({ id: "claim:x" })) }));
    expect(params.toString()).toBe("view=3d");
    expect(graphWebsiteHref("https://graph.test", "embed=android&appOrigin=https%3A%2F%2Fevil.test")).toBe("https://graph.test/graph?view=3d");
  });
  it("allows only the app destinations used by Graph reporting and saved journeys", () => {
    expect(graphAppDestination("/report-issue#report=%7B%7D")).toBe("/report-issue#report=%7B%7D");
    expect(graphAppDestination("/research/journeys/")).toBe("/research/journeys/");
    for (const path of ["//evil.test", "https://evil.test", "/admin", "/api/auth/logout", "/login?next=https://evil.test"]) expect(graphAppDestination(path)).toBeNull();
  });
});
