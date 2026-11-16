// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteAccountPanel } from "./DeleteAccountPanel";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

afterEach(() => {
  vi.restoreAllMocks();
  navigation.replace.mockReset();
  navigation.refresh.mockReset();
});

it("requires sign-in to verify account ownership", () => {
  render(<DeleteAccountPanel signedIn={false} accountType={null} />);
  expect(screen.getByRole("link", { name: "Sign in to continue" })).toHaveAttribute("href", "/login?next=%2Faccount%2Fdelete");
  expect(screen.queryByRole("button", { name: /Permanently delete/ })).not.toBeInTheDocument();
});

it("keeps staff accounts out of learner self-service deletion", () => {
  render(<DeleteAccountPanel signedIn accountType="staff" />);
  expect(screen.getByText(/cannot be deleted through the learner self-service flow/)).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("requires literal DELETE and sends a protected request while preserving a server refusal", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => new Response(JSON.stringify(url === "/api/auth/csrf" ? { csrfToken: "csrf-test" } : { error: "Please sign in again." }), { status: url === "/api/auth/csrf" ? 200 : 401 }));
  render(<DeleteAccountPanel signedIn accountType="public" />);
  const button = screen.getByRole("button", { name: "Permanently delete account" });
  expect(screen.getByText("This cannot be undone.")).toBeVisible();
  await user.type(screen.getByRole("textbox"), "delete");
  expect(button).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
  await user.clear(screen.getByRole("textbox"));
  await user.type(screen.getByRole("textbox"), "DELETE");
  await user.click(button);
  expect(await screen.findByRole("status")).toHaveTextContent("Please sign in again.");
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({ method: "DELETE", credentials: "include", headers: expect.objectContaining({ "x-csrf-token": "csrf-test" }), body: JSON.stringify({ confirmation: "DELETE" }) }));
  expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/account?section=privacy");
});

it("clears local state and returns home through client routing after deletion", async () => {
  const nativeSetTimeout = window.setTimeout.bind(window);
  let redirect: (() => void) | undefined;
  vi.spyOn(window, "setTimeout").mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay === 1200 && typeof handler === "function") {
      redirect = handler as () => void;
      return 1;
    }
    return nativeSetTimeout(handler, delay, ...args);
  }) as typeof window.setTimeout);
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => new Response(JSON.stringify(
    url === "/api/auth/csrf" ? { csrfToken: "csrf-test" } : { ok: true },
  ), { status: 200 }));
  const clearLocal = vi.spyOn(Storage.prototype, "clear");
  render(<DeleteAccountPanel signedIn accountType="public" />);

  await userEvent.type(screen.getByRole("textbox"), "DELETE");
  await userEvent.click(screen.getByRole("button", { name: "Permanently delete account" }));
  expect(await screen.findByRole("status")).toHaveTextContent("were deleted");

  expect(redirect).toBeTypeOf("function");
  redirect?.();
  expect(clearLocal).toHaveBeenCalledTimes(2);
  expect(navigation.replace).toHaveBeenCalledWith("/");
  expect(navigation.refresh).toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
