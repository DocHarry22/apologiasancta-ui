// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ResearchDiscovery, { RESEARCH_DISCOVERY_REQUEST_TIMEOUT_MS } from "./ResearchDiscovery";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const nodes = [{ id: "claim:a", title: "Central claim" }, { id: "claim:b", title: "Connected claim" }];
const neighborhood = { nodes, edges: [{ id: "edge:one", fromNodeId: "claim:b", toNodeId: "claim:a", relationshipType: "supports" }, { id: "edge:two", fromNodeId: "claim:b", toNodeId: "claim:a", relationshipType: "distinguishes" }] };
it("suggests distinct published pairs with direction and preserves the comparison lens", async () => {
  vi.stubGlobal("fetch", vi.fn(async (path: string) => ({ ok: true, json: async () => path.includes("topics") ? { topics: [{ id: "topic:a", rootNodeId: "claim:a", title: "Reviewed topic" }] } : neighborhood })));
  render(<ResearchDiscovery lens="historical" />);
  const link = await screen.findByRole("link", { name: /Compare these claims/ });
  const href = new URL(link.getAttribute("href") || "", "https://app.test");
  expect(href.searchParams.get("left")).toBe("claim:b");
  expect(href.searchParams.get("right")).toBe("claim:a");
  expect(href.searchParams.get("lens")).toBe("historical");
  expect(screen.getAllByRole("link", { name: /Compare these claims/ })).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Reviewed topic" })).toBeVisible();
});
it("keeps comparisons for a selected claim available when topics fail", async () => {
  vi.stubGlobal("fetch", vi.fn(async (path: string) => path.includes("topics") ? { ok: false } : { ok: true, json: async () => neighborhood }));
  render(<ResearchDiscovery anchor="claim:a" />);
  await screen.findByRole("link", { name: /Compare these claims/ });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Some suggestions are unavailable"));
});
it("turns a hung Knowledge request into a retryable state", async () => {
  vi.useFakeTimers();
  const request = vi.fn((_path: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  vi.stubGlobal("fetch", request);

  render(<ResearchDiscovery />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading research starting points");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(RESEARCH_DISCOVERY_REQUEST_TIMEOUT_MS);
  });

  expect(screen.getByRole("status")).toHaveTextContent("Some suggestions are unavailable");
  expect(screen.getByRole("button", { name: "Retry suggestions" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Continue in the library" })).toBeVisible();
  expect(screen.getAllByRole("link", { name: /in the library/ })).toHaveLength(4);
  expect(request).toHaveBeenCalledTimes(1);
});

it("does not duplicate a parent-provided outage fallback", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
  render(<ResearchDiscovery showLibraryFallback={false} />);

  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Some suggestions are unavailable"));
  expect(screen.queryByRole("heading", { name: "Continue in the library" })).not.toBeInTheDocument();
});
