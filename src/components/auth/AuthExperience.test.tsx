// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  readAuthSessionEpoch,
  readStoredPlayerIdentity,
  saveStoredAccountPlayerIdentity,
} from "@/lib/playerIdentity";
import { AuthExperience } from "./AuthExperience";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

const defaultProps = {
  defaultNextPath: "/",
  allowedNextPrefixes: ["/account", "/admin"],
};

describe("AuthExperience", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.refresh.mockReset();
    localStorage.clear();
    window.history.replaceState({}, "", "/login");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps staff invite entry conditional and explicit", async () => {
    const user = userEvent.setup();
    render(<AuthExperience {...defaultProps} initialMode="signup" />);

    expect(screen.queryByLabelText("Staff invite code")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Staff/i }));
    expect(screen.getByLabelText("Staff invite code")).toBeRequired();
  });

  it("shows a safe deployment reason with its diagnostic reference", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        reason: "database_connection_timeout",
        diagnosticId: "auth-ref-123",
      }),
    }));

    render(<AuthExperience {...defaultProps} initialMode="signin" />);
    await user.type(screen.getByLabelText("Email address"), "learner@example.test");
    await user.type(screen.getByLabelText(/^Password/), "valid-password");
    await user.click(screen.getByRole("button", { name: "Sign in securely" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("account database connection timed out");
    expect(screen.getByRole("alert")).toHaveTextContent("auth-ref-123");
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("keeps entered details when switching modes with the keyboard and supports password visibility", async () => {
    const user = userEvent.setup();
    render(<AuthExperience {...defaultProps} initialMode="signin" />);
    await user.type(screen.getByLabelText("Email address"), "learner@example.test");
    await user.type(screen.getByLabelText("Password", { exact: true }), "a-long-passphrase");
    await user.click(screen.getByRole("button", { name: "Show password", exact: true }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "text");
    screen.getByRole("tab", { name: "Sign in", exact: true }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Create account" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Grow in faith.");
    expect(screen.getByLabelText("Email address")).toHaveValue("learner@example.test");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("a-long-passphrase");
    await user.click(screen.getByRole("button", { name: "Hide confirm password", exact: true }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Confirm password", { exact: true })).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAccessibleDescription(/at least 8 characters/);
  });

  it("focuses mismatched-password feedback, prevents mode changes while submitting, and continues to verification", async () => {
    const user = userEvent.setup();
    let finish: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthExperience {...defaultProps} initialMode="signup" />);
    await user.type(screen.getByLabelText("Display name"), "Ada Learner");
    await user.type(screen.getByLabelText("Email address"), "learner@example.test");
    await user.type(screen.getByLabelText("Password", { exact: true }), "a-long-passphrase");
    await user.type(screen.getByLabelText("Confirm password", { exact: true }), "different-passphrase");
    await user.click(screen.getByRole("button", { name: "Create account", exact: true }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Confirm password", { exact: true }));
    await user.type(screen.getByLabelText("Confirm password", { exact: true }), "a-long-passphrase");
    await user.click(screen.getByRole("button", { name: "Create account", exact: true }));
    expect(screen.getByRole("tab", { name: "Sign in", exact: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Creating account…" })).toBeDisabled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ name: "Ada Learner", email: "learner@example.test", inviteCode: "", phone: "" });
    finish(new Response(JSON.stringify({ verificationRequired: true }), { status: 201 }));
    await screen.findByRole("button", { name: "Create account", exact: true });
    expect(router.push).toHaveBeenCalledWith("/verify-email");
  });

  it("submits staff invitation and optional phone details without weakening the invite requirement", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ verificationRequired: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthExperience {...defaultProps} initialMode="signup" />);
    await user.click(screen.getByRole("radio", { name: /Staff/ }));
    await user.type(screen.getByLabelText("Display name"), "Ada Staff");
    await user.type(screen.getByLabelText("Email address"), "staff@example.test");
    await user.type(screen.getByLabelText("Password", { exact: true }), "a-long-passphrase");
    await user.type(screen.getByLabelText("Confirm password", { exact: true }), "a-long-passphrase");
    expect(screen.getByRole("button", { name: "Create account", exact: true })).toBeDisabled();
    await user.type(screen.getByLabelText("Staff invite code"), "sample-invitation");
    await user.click(screen.getByText("Optional details", { exact: true }));
    await user.type(screen.getByLabelText("Phone (optional)", { exact: true }), "+27820000000");
    await user.click(screen.getByRole("button", { name: "Create account", exact: true }));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/signup", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ inviteCode: "sample-invitation", phone: "+27820000000" });
  });

  it("rejects a lookalike next path outside an allowed route boundary", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/login?next=/administrator");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));

    render(
      <AuthExperience
        initialMode="signin"
        defaultNextPath="/account"
        allowedNextPrefixes={["/admin"]}
      />
    );
    await user.type(screen.getByLabelText("Email address"), "staff@example.test");
    await user.type(screen.getByLabelText(/^Password/), "valid-password");
    await user.click(screen.getByRole("button", { name: "Sign in securely" }));

    expect(router.push).toHaveBeenCalledWith("/account");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("invalidates the account room credential before a dropped logout response", async () => {
    const user = userEvent.setup();
    saveStoredAccountPlayerIdentity(
      "acct_11111111-1111-4111-8111-111111111111",
      "Thomas_A",
      "room-token.signature",
      "session-binding"
    );
    const initialEpoch = readAuthSessionEpoch();
    let dispatchEpoch = initialEpoch;
    const fetchMock = vi.fn().mockImplementation(() => {
      dispatchEpoch = readAuthSessionEpoch();
      return Promise.reject(new Error("response dropped"));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthExperience {...defaultProps} initialMode="signin" />);
    await user.click(screen.getByRole("button", { name: "Clear saved session" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be cleared");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(dispatchEpoch).toBeGreaterThan(initialEpoch);
    expect(readAuthSessionEpoch()).toBeGreaterThan(dispatchEpoch);
    expect(readStoredPlayerIdentity()).toEqual({
      userId: null,
      username: null,
      joinToken: null,
      accountSessionBinding: null,
    });
  });
});
