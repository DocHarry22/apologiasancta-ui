// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANDROID_APPLICATION_ID, ANDROID_RELEASES_URL, ANDROID_UPDATE_INTERVAL_MS, ANDROID_UPDATE_SNOOZE_KEY } from "@/lib/androidUpdates";
import { AndroidUpdatePrompt } from "./AndroidUpdatePrompt";

const native = vi.hoisted(() => ({ getInfo: vi.fn(), addListener: vi.fn(), remove: vi.fn() }));
vi.mock("@capacitor/app", () => ({ App: native }));
const update = {
  schemaVersion: 1, applicationId: ANDROID_APPLICATION_ID, versionCode: 4, versionName: "1.0.4",
  apkUrl: `${ANDROID_RELEASES_URL}/download/android-v1.0.4/apologia-sancta.apk`,
  releaseUrl: `${ANDROID_RELEASES_URL}/tag/android-v1.0.4`, apkSha256: "a".repeat(64), signingCertSha256: "b".repeat(64),
};
const answer = (payload: unknown) => ({ ok: true, json: async () => payload });

describe("Android installed-version update prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    native.getInfo.mockResolvedValue({ id: ANDROID_APPLICATION_ID, name: "Apologia Sancta", version: "1.0.3", build: "3" });
    native.addListener.mockResolvedValue({ remove: native.remove });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer({ update })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("automatically offers the version-specific official APK on launch", async () => {
    render(<AndroidUpdatePrompt />);
    expect(await screen.findByRole("dialog", { name: "App update available" })).toHaveTextContent("You have version 1.0.3");
    expect(screen.getByRole("link", { name: "Download update" })).toHaveAttribute("href", update.apkUrl);
    expect(fetch).toHaveBeenCalledWith("/api/android/updates", expect.objectContaining({ cache: "no-store" }));
  });
  it.each(["4", "5"])("does not notify for an installed build of %s or newer", async (build) => {
    native.getInfo.mockResolvedValue({ id: ANDROID_APPLICATION_ID, version: `1.0.${build}`, build });
    render(<AndroidUpdatePrompt />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("remembers Later for this version but allows a different version to notify", async () => {
    const first = render(<AndroidUpdatePrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Later" }));
    expect(JSON.parse(localStorage.getItem(ANDROID_UPDATE_SNOOZE_KEY)!)).toMatchObject({ versionCode: 4 });
    first.unmount();
    const second = render(<AndroidUpdatePrompt />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    second.unmount();
    vi.mocked(fetch).mockResolvedValue(answer({ update: {
      ...update, versionCode: 5, versionName: "1.0.5",
      apkUrl: update.apkUrl.replace("1.0.4", "1.0.5"), releaseUrl: update.releaseUrl.replace("1.0.4", "1.0.5"),
    } }) as Response);
    render(<AndroidUpdatePrompt />);
    expect(await screen.findByRole("dialog")).toBeVisible();
  });
  it("rechecks when Android resumes and periodically while open", async () => {
    const intervals = vi.spyOn(window, "setInterval");
    vi.mocked(fetch).mockResolvedValue(answer({ update: null }) as Response);
    render(<AndroidUpdatePrompt />);
    await waitFor(() => expect(native.addListener).toHaveBeenCalled());
    const resume = native.addListener.mock.calls[0][1];
    const now = Date.now() + 31000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    await act(async () => { resume({ isActive: true }); });
    expect(fetch).toHaveBeenCalledTimes(2);
    const poll = intervals.mock.calls.find(([, delay]) => delay === ANDROID_UPDATE_INTERVAL_MS)?.[0] as () => void;
    expect(poll).toBeTypeOf("function");
    clock.mockReturnValue(now + ANDROID_UPDATE_INTERVAL_MS);
    await act(async () => { poll(); });
    expect(fetch).toHaveBeenCalledTimes(3);
    clock.mockReturnValue(now + ANDROID_UPDATE_INTERVAL_MS * 2);
    await act(async () => { resume({ isActive: false }); poll(); });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("retries on reconnect, contains network errors, and removes its listener", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const view = render(<AndroidUpdatePrompt />);
    await waitFor(() => expect(native.addListener).toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
    expect(native.remove).toHaveBeenCalledTimes(1);
  });
  it("does not guess the installed version when the old APK cannot report it", async () => {
    native.getInfo.mockRejectedValue(new Error("Plugin not implemented"));
    render(<AndroidUpdatePrompt />);
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("still notifies and dismisses when persistent storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<AndroidUpdatePrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
