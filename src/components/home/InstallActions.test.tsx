// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstallActions } from "./InstallActions";

const publicEnv = vi.hoisted(() => ({
  apkUrl: "https://example.test/apologia-sancta.apk" as string | null,
}));

vi.mock("@/lib/publicEnv", () => ({
  getAndroidApkUrl: () => publicEnv.apkUrl,
  isEngineConfigured: () => true,
}));

function dispatchInstallPrompt({
  prompt,
  userChoice,
}: {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}) {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.defineProperties(event, {
    prompt: { value: prompt },
    userChoice: { value: userChoice },
  });
  window.dispatchEvent(event);
}

describe("InstallActions", () => {
  beforeEach(() => {
    publicEnv.apkUrl = "https://example.test/apologia-sancta.apk";
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it("contains a rejected install prompt and restores a usable fallback state", async () => {
    const user = userEvent.setup();
    render(<InstallActions />);

    act(() => {
      dispatchInstallPrompt({
        prompt: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
        userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
      });
    });

    const installButton = screen.getByRole("button", { name: "Install App" });
    await user.click(installButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(/browser menu/i);
    await waitFor(() => expect(installButton).toBeDisabled());
    expect(installButton).toHaveTextContent("Install App");
  });

  it("marks an accepted browser install as installed", async () => {
    const user = userEvent.setup();
    render(<InstallActions />);

    act(() => {
      dispatchInstallPrompt({
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      });
    });

    await user.click(screen.getByRole("button", { name: "Install App" }));
    expect(await screen.findByRole("button", { name: "Installed" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders a non-interactive status when no APK has been published", () => {
    publicEnv.apkUrl = null;
    render(<InstallActions />);

    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("APK Not Published Yet");
    expect(screen.queryByRole("link", { name: /download published apk/i })).not.toBeInTheDocument();
  });
});
