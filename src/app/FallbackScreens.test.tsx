// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import ErrorPage from "./error";
import NotFound from "./not-found";
import Loading from "./loading";

vi.mock("@/components/shell/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

it("retries a failed screen without exposing internal error details", async () => {
  const retry = vi.fn();
  render(<ErrorPage retry={retry} error={new Error("Private database connection details")} />);
  expect(screen.queryByText(/Private database/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Back to learning" })).toHaveAttribute("href", "/learn");
});

it("provides working home and learning destinations for a missing page", () => {
  render(<NotFound />);
  expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/native");
  expect(screen.getByRole("link", { name: "Explore learning" })).toHaveAttribute("href", "/learn");
});

it("announces screen loading without exposing decorative skeletons", () => {
  render(<Loading />);
  expect(screen.getByRole("status", { name: "Loading this screen" })).toHaveTextContent("Loading this screen…");
  expect(screen.getByRole("status").querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
});
