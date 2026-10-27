// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import GraphExperience from "./GraphExperience";
import { GraphLink } from "./GraphLink";

const mocks = vi.hoisted(() => { const push = vi.fn(); return { push, router: { push }, native: true }; });
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/publicEnv", () => ({ getResearchGraphUrl: () => "https://graph.test" }));
vi.mock("@/lib/native", () => ({ isNativePlatform: () => mocks.native }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); mocks.push.mockClear(); mocks.native = true; });

async function frame() { return await screen.findByTitle("Apologia Graph 3D engine") as HTMLIFrameElement; }
function message(node: HTMLIFrameElement, data: unknown, origin = "https://graph.test", source = node.contentWindow) {
  fireEvent(window, new MessageEvent("message", { data, origin, source }));
}
it("loads the live website with 3D navigation and retains an external website fallback", async () => {
  render(<GraphExperience navigation="focus=claim%3Acreed&depth=3&view=3d" />);
  const node = await frame(), url = new URL(node.src);
  expect(url.origin).toBe("https://graph.test");
  expect(url.searchParams.get("view")).toBe("3d");
  expect(url.searchParams.get("focus")).toBe("claim:creed");
  expect(url.searchParams.get("embed")).toBe("android");
  expect(node.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  fireEvent.load(node);
  expect(screen.queryByText("Opening your galaxy…")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Graph website" })).toHaveAttribute("href", "https://graph.test/graph?focus=claim%3Acreed&view=3d&depth=3");
});
it("rejects messages from another origin or window and whitelists navigation from the real frame", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  render(<GraphExperience navigation="view=3d" />);
  const node = await frame();
  message(node, { channel: "apologia-graph-journeys-v1", type: "hello" }, "https://evil.test");
  message(node, { channel: "apologia-graph-journeys-v1", type: "hello" }, "https://graph.test", window);
  message(node, { channel: "apologia-graph-embed-v1", type: "open-app", path: "/admin" });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
  message(node, { channel: "apologia-graph-embed-v1", type: "open-app", path: "/research/journeys" });
  expect(mocks.push).toHaveBeenCalledWith("/research/journeys");
  message(node, { channel: "apologia-graph-embed-v1", type: "exit" });
  expect(mocks.push).toHaveBeenCalledWith("/research");
});
it("uses the existing app session for an explicit account connection and offers sign-in on failure", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Sign in" }, { status: 401 }));
  render(<GraphExperience navigation="view=3d" />);
  const node = await frame();
  const send = vi.spyOn(node.contentWindow!, "postMessage");
  message(node, { channel: "apologia-graph-journeys-v1", type: "hello" });
  expect(await screen.findByRole("link", { name: "Sign in to connect saves" })).toHaveAttribute("href", "/login?next=%2Fresearch%2Fgraph%3Fview%3D3d");
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({ credentials: "same-origin", cache: "no-store" }));
  await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ channel: "apologia-graph-journeys-v1", type: "unavailable" }), "https://graph.test"));
});
it("reports a slow connection and can reload the embedded engine", async () => {
  vi.useFakeTimers();
  render(<GraphExperience navigation="view=3d" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(20001); });
  expect(screen.getByText(/Graph is taking longer to load/)).toBeVisible();
  const old = screen.getByTitle("Apologia Graph 3D engine");
  fireEvent.click(screen.getByRole("button", { name: "Retry Graph" }));
  expect(screen.getByTitle("Apologia Graph 3D engine")).not.toBe(old);
  expect(screen.getByText("Opening your galaxy…")).toBeVisible();
});
it("shows offline recovery without removing the graph workspace", async () => {
  render(<GraphExperience navigation="view=3d" />);
  await frame();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  fireEvent(window, new Event("offline"));
  expect(screen.getByText(/You’re offline/)).toBeVisible();
  expect(screen.getByTitle("Apologia Graph 3D engine")).toBeInTheDocument();
});
it("expands the same engine and restores page scrolling when collapsed", async () => {
  render(<GraphExperience navigation="view=3d" />);
  const node = await frame();
  const overflow = document.body.style.overflow;
  fireEvent.click(screen.getByRole("button", { name: "Expand Graph" }));
  expect(document.body.style.overflow).toBe("hidden");
  expect(screen.getByTitle("Apologia Graph 3D engine")).toBe(node);
  fireEvent.click(screen.getByRole("button", { name: "Collapse Graph" }));
  expect(document.body.style.overflow).toBe(overflow);
});
it("routes Graph paths inside Android and preserves normal website links elsewhere", async () => {
  const { rerender } = render(<GraphLink href="https://graph.test/graph/creed?focus=claim%3Acreed&view=2d">Reopen Graph</GraphLink>);
  await waitFor(() => expect(screen.getByRole("link", { name: "Reopen Graph" })).toHaveAttribute("href", "/research/graph?record=creed&focus=claim%3Acreed&view=2d"));
  expect(screen.getByRole("link")).not.toHaveAttribute("target");
  mocks.native = false;
  rerender(<GraphLink key="web" href="https://graph.test/graph">Open Graph website</GraphLink>);
  expect(screen.getByRole("link", { name: "Open Graph website" })).toHaveAttribute("target", "_blank");
});
