// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResearchFallbackPrompts } from "./ResearchFallbackPrompts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

it("keeps curated library paths visible while Knowledge topics are unavailable", () => {
  render(<ResearchFallbackPrompts knowledgeAvailable={false} />);

  expect(screen.getByRole("heading", { name: "Research is taking a moment." })).toBeVisible();
  expect(screen.getByRole("button", { name: "Retry topics" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Study Is Jesus truly God? in the library" })).toHaveAttribute("href", "/library/christology");
  expect(screen.getByRole("link", { name: "Study Where is the Trinity in Scripture? in the library" })).toHaveAttribute("href", "/library/trinity");
  expect(screen.getByRole("link", { name: "Study Did the early Church believe in the Eucharist? in the library" })).toHaveAttribute("href", "/library/eucharist");
  expect(screen.getByRole("link", { name: "Study What authority did Christ give Peter? in the library" })).toHaveAttribute("href", "/library/ecclesiology");
});

it("keeps the same safe starting paths when no reviewed journey has been published", () => {
  render(<ResearchFallbackPrompts knowledgeAvailable />);

  expect(screen.getByRole("heading", { name: "More paths are being prepared." })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Retry topics" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /in the library/ })).toHaveLength(4);
});
