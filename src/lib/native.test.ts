// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hapticMocks = vi.hoisted(() => ({
  notification: vi.fn(),
  impact: vi.fn(),
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: hapticMocks,
  NotificationType: { Success: "success", Error: "error" },
  ImpactStyle: { Light: "light" },
}));

type ReleaseListener = () => void;

function createSentinel(options: { rejectRelease?: boolean } = {}) {
  const listeners = new Set<ReleaseListener>();
  const sentinel = {
    released: false,
    addEventListener: vi.fn((_type: "release", listener: ReleaseListener) => {
      listeners.add(listener);
    }),
    release: vi.fn(async () => {
      if (options.rejectRelease) throw new DOMException("Release failed", "NotAllowedError");
      sentinel.released = true;
      listeners.forEach((listener) => listener());
    }),
    autoRelease() {
      sentinel.released = true;
      listeners.forEach((listener) => listener());
    },
  };
  return sentinel;
}

function setWakeLockRequest(request: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
}

describe("best-effort native side effects", () => {
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    vi.resetModules();
    hapticMocks.notification.mockReset();
    hapticMocks.impact.mockReset();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    delete (window as Window & { Capacitor?: unknown }).Capacitor;
  });

  afterEach(async () => {
    const native = await import("./native");
    await native.allowSleep();
    Reflect.deleteProperty(navigator, "wakeLock");
    delete (window as Window & { Capacitor?: unknown }).Capacitor;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("contains denied wake-lock requests and permits a later retry", async () => {
    const sentinel = createSentinel();
    const request = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"))
      .mockResolvedValueOnce(sentinel);
    setWakeLockRequest(request);
    const native = await import("./native");

    await expect(native.keepAwake()).resolves.toBeUndefined();
    await expect(native.keepAwake()).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledTimes(2);
    await native.allowSleep();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent wake-lock requests", async () => {
    const sentinel = createSentinel();
    let resolveRequest: ((value: typeof sentinel) => void) | undefined;
    const request = vi.fn(() => new Promise<typeof sentinel>((resolve) => {
      resolveRequest = resolve;
    }));
    setWakeLockRequest(request);
    const native = await import("./native");

    const first = native.keepAwake();
    const second = native.keepAwake();
    expect(request).toHaveBeenCalledTimes(1);

    resolveRequest?.(sentinel);
    await Promise.all([first, second]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("releases a request that resolves after sleep was requested", async () => {
    const sentinel = createSentinel();
    let resolveRequest: ((value: typeof sentinel) => void) | undefined;
    const request = vi.fn(() => new Promise<typeof sentinel>((resolve) => {
      resolveRequest = resolve;
    }));
    setWakeLockRequest(request);
    const native = await import("./native");

    const awake = native.keepAwake();
    const asleep = native.allowSleep();
    resolveRequest?.(sentinel);

    await Promise.all([awake, asleep]);
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it("releases while hidden and reacquires when the document becomes visible", async () => {
    const first = createSentinel();
    const second = createSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    setWakeLockRequest(request);
    const native = await import("./native");

    await native.keepAwake();
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(first.release).toHaveBeenCalledTimes(1));

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await native.allowSleep();
    expect(second.release).toHaveBeenCalledTimes(1);
  });

  it("reacquires an automatically released lock while the round remains active", async () => {
    const first = createSentinel();
    const second = createSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    setWakeLockRequest(request);
    const native = await import("./native");

    await native.keepAwake();
    first.autoRelease();

    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await native.allowSleep();
    expect(second.release).toHaveBeenCalledTimes(1);
  });

  it("contains wake-lock release failures", async () => {
    const sentinel = createSentinel({ rejectRelease: true });
    setWakeLockRequest(vi.fn().mockResolvedValue(sentinel));
    const native = await import("./native");

    await native.keepAwake();
    await expect(native.allowSleep()).resolves.toBeUndefined();
  });

  it("contains haptic plugin failures", async () => {
    hapticMocks.notification.mockRejectedValue(new Error("Native bridge unavailable"));
    hapticMocks.impact.mockRejectedValue(new Error("Native bridge unavailable"));
    (window as Window & { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    const native = await import("./native");

    await expect(native.hapticSuccess()).resolves.toBeUndefined();
    await expect(native.hapticError()).resolves.toBeUndefined();
    await expect(native.hapticLight()).resolves.toBeUndefined();

    expect(hapticMocks.notification).toHaveBeenCalledTimes(2);
    expect(hapticMocks.impact).toHaveBeenCalledTimes(1);
  });

  it("does not treat the Capacitor web shim as a native platform", async () => {
    (window as Window & { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => false,
      getPlatform: () => "web",
    };
    const native = await import("./native");

    expect(native.isNativePlatform()).toBe(false);
    await native.hapticSuccess();
    expect(hapticMocks.notification).not.toHaveBeenCalled();
  });
});
