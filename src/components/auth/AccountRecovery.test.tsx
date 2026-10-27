// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountRecovery, EmailVerificationPanel } from "./AccountRecovery";
import { readAuthSessionEpoch, readStoredPlayerIdentity, saveStoredAccountPlayerIdentity } from "@/lib/playerIdentity";

vi.mock("@/components/ui/ThemeToggle", () => ({ ThemeToggle: () => <button>Theme</button> }));
const token = "a".repeat(64);

describe("account recovery UI", () => {
  beforeEach(() => { localStorage.clear(); window.history.replaceState({}, "", "/forgot-password"); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("requests a reset link, shows the generic confirmation, and prevents immediate resends", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, message: "If an eligible account uses this address, a password reset link will arrive shortly." }))));
    const user = userEvent.setup();
    render(<AccountRecovery mode="forgot" />);
    await user.type(screen.getByLabelText("Email address"), "learner@example.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByRole("status")).toHaveTextContent("If an eligible account");
    expect(screen.getByRole("status")).toHaveFocus();
    expect(screen.getByRole("button", { name: /Try again in/ })).toBeDisabled();
    expect(fetch).toHaveBeenCalledWith("/api/auth/forgot-password", expect.objectContaining({ method: "POST" }));
  });

  it("captures a token once in strict mode, strips it from the URL, and waits for user confirmation", async () => {
    window.history.replaceState({}, "", `/verify-email#token=${token}`);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"ok":true}')));
    const user = userEvent.setup();
    render(<StrictMode><AccountRecovery mode="verify" /></StrictMode>);
    expect(window.location.hash).toBe("");
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify email address" }));
    expect(screen.getByRole("status")).toHaveTextContent("Email verified");
    expect(fetch).toHaveBeenCalledWith("/api/auth/verify-email", expect.objectContaining({ body: expect.stringContaining(token) }));
  });

  it("validates matching passwords and signs users back in explicitly after success", async () => {
    window.history.replaceState({}, "", `/reset-password#token=${token}`);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"ok":true}')));
    const user = userEvent.setup();
    render(<AccountRecovery mode="reset" />);
    expect(screen.getByLabelText("New password")).toHaveAccessibleDescription(/8–256 characters/);
    await user.click(screen.getByRole("button", { name: "Show new password", exact: true }));
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide confirm new password", exact: true }));
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute("type", "password");
    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "other-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match");
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("Confirm new password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("status")).toHaveTextContent("All signed-in sessions have ended");
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("offers a replacement link for an expired token", async () => {
    window.history.replaceState({}, "", `/verify-email#token=${token}`);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "invalid_link", error: "This link is expired or already used. Request a new link." }), { status: 400 })));
    const user = userEvent.setup();
    render(<AccountRecovery mode="verify" />);
    await user.click(screen.getByRole("button", { name: "Verify email address" }));
    expect(screen.getByRole("alert")).toHaveTextContent("expired or already used");
    expect(screen.getByRole("button", { name: "Resend verification email" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("shows throttling feedback and honors Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"Too many attempts. Please try again later."}', { status: 429, headers: { "Retry-After": "120" } })));
    const user = userEvent.setup();
    render(<AccountRecovery mode="forgot" />);
    await user.type(screen.getByLabelText("Email address"), "learner@example.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts");
    expect(screen.getByRole("button", { name: "Try again in 120s" })).toBeDisabled();
  });

  it("exposes verification status in account security", () => {
    const { rerender } = render(<EmailVerificationPanel />);
    expect(screen.getByRole("link", { name: "Verify email" })).toHaveAttribute("href", "/verify-email");
    rerender(<EmailVerificationPanel verifiedAt="2026-10-21T10:00:00Z" />);
    expect(screen.getByText("Your email address is verified.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the form retryable when the network is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const user = userEvent.setup();
    render(<AccountRecovery mode="forgot" />);
    await user.type(screen.getByLabelText("Email address"), "learner@example.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Check your connection and try again");
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
  });

  it("offers a fresh reset request after an expired link and excludes the expired token from that request", async () => {
    window.history.replaceState({}, "", `/reset-password#token=${token}`);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "invalid_link", error: "This link is expired. Request a new link." }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AccountRecovery mode="reset" />);
    await user.type(screen.getByLabelText("New password"), "a-new-passphrase");
    await user.type(screen.getByLabelText("Confirm new password"), "a-new-passphrase");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("expired");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Request a new reset link", exact: true })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email address"), "learner@example.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/forgot-password", expect.objectContaining({ body: JSON.stringify({ email: "learner@example.test" }) }));
    expect(screen.getByRole("button", { name: /Try again in/ })).toBeDisabled();
  });

  it("invalidates saved account quiz credentials before a reset request even when its response is lost", async () => {
    window.history.replaceState({}, "", `/reset-password#token=${token}`);
    saveStoredAccountPlayerIdentity("acct_sample", "Ada", "sample-join-token", "sample-binding");
    const initialEpoch = readAuthSessionEpoch();
    let dispatchedEpoch = initialEpoch;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      dispatchedEpoch = readAuthSessionEpoch();
      expect(readStoredPlayerIdentity().joinToken).toBeNull();
      return Promise.reject(new TypeError("Response lost"));
    }));
    const user = userEvent.setup();
    render(<AccountRecovery mode="reset" />);
    await user.type(screen.getByLabelText("New password"), "a-new-passphrase");
    await user.type(screen.getByLabelText("Confirm new password"), "a-new-passphrase");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Check your connection");
    expect(dispatchedEpoch).toBeGreaterThan(initialEpoch);
    expect(readAuthSessionEpoch()).toBeGreaterThan(dispatchedEpoch);
    expect(readStoredPlayerIdentity().userId).toBeNull();
    expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
  });
});
