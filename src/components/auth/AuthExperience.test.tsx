// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthExperience } from "./AuthExperience";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/components/shell/BrandMark", () => ({
  BrandMark: () => <span>Apologia Sancta</span>,
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
});
