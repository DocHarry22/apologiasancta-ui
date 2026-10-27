// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ResearchDiscovery from "./ResearchDiscovery";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
