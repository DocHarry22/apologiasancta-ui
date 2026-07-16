/**
 * Native Capacitor utilities — all functions are no-ops on web.
 * Import from here instead of directly from Capacitor plugins so
 * SSR and web builds never break.
 */

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
  if (!bridge) return false;

  try {
    if (typeof bridge.isNativePlatform === "function") return bridge.isNativePlatform();
    if (typeof bridge.getPlatform === "function") return bridge.getPlatform() !== "web";
  } catch {
    return false;
  }

  // A partially initialized web shim is not proof that the app is native.
  return false;
}

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (
    type: "release",
    listener: () => void,
    options?: { once?: boolean },
  ) => void;
};

let wakeLock: WakeLockSentinelLike | null = null;
let wakeLockRequest: Promise<void> | null = null;
let shouldKeepAwake = false;
let wakeLockOperation = 0;
let visibilityListenerAttached = false;

async function runBestEffort(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    // Native feedback and wake locks are progressive enhancements. Permission
    // denials or unavailable plugins must never become unhandled rejections.
  }
}

// ---------------------------------------------------------------------------
// Haptics
// ---------------------------------------------------------------------------

export async function hapticSuccess(): Promise<void> {
  if (!isNativePlatform()) return;
  await runBestEffort(async () => {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  });
}

export async function hapticError(): Promise<void> {
  if (!isNativePlatform()) return;
  await runBestEffort(async () => {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Error });
  });
}

export async function hapticLight(): Promise<void> {
  if (!isNativePlatform()) return;
  await runBestEffort(async () => {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  });
}

// ---------------------------------------------------------------------------
// Keep screen awake
// ---------------------------------------------------------------------------

function canRequestWakeLock(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

function getWakeLockManager(): {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
} | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
  };
  return nav.wakeLock ?? null;
}

async function releaseWakeLock(lock: WakeLockSentinelLike | null): Promise<void> {
  if (!lock || lock.released) return;
  await runBestEffort(() => lock.release());
}

function handleWakeLockRelease(lock: WakeLockSentinelLike): void {
  if (wakeLock === lock) wakeLock = null;
  if (shouldKeepAwake && canRequestWakeLock()) {
    queueMicrotask(() => { void requestWakeLock(); });
  }
}

async function requestWakeLock(): Promise<void> {
  const manager = getWakeLockManager();
  if (!manager || !shouldKeepAwake || !canRequestWakeLock() || wakeLock) return;
  if (wakeLockRequest) return wakeLockRequest;

  const request = runBestEffort(async () => {
    const lock = await manager.request("screen");

    if (!shouldKeepAwake || !canRequestWakeLock()) {
      await releaseWakeLock(lock);
      return;
    }

    wakeLock = lock;
    lock.addEventListener?.("release", () => handleWakeLockRelease(lock), { once: true });
    if (lock.released) handleWakeLockRelease(lock);
  }).finally(() => {
    if (wakeLockRequest === request) wakeLockRequest = null;
  });

  wakeLockRequest = request;
  await request;
}

function handleVisibilityChange(): void {
  if (!shouldKeepAwake) return;
  if (canRequestWakeLock()) {
    void requestWakeLock();
    return;
  }

  const lock = wakeLock;
  wakeLock = null;
  void releaseWakeLock(lock);
}

function attachVisibilityListener(): void {
  if (typeof document === "undefined" || visibilityListenerAttached) return;
  document.addEventListener("visibilitychange", handleVisibilityChange);
  visibilityListenerAttached = true;
}

function detachVisibilityListener(): void {
  if (typeof document === "undefined" || !visibilityListenerAttached) return;
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  visibilityListenerAttached = false;
}

export async function keepAwake(): Promise<void> {
  shouldKeepAwake = true;
  wakeLockOperation += 1;
  attachVisibilityListener();
  await requestWakeLock();
}

export async function allowSleep(): Promise<void> {
  shouldKeepAwake = false;
  const operation = ++wakeLockOperation;
  detachVisibilityListener();

  if (wakeLockRequest) await wakeLockRequest;
  if (operation !== wakeLockOperation || shouldKeepAwake) return;

  const lock = wakeLock;
  wakeLock = null;
  await releaseWakeLock(lock);
}

// ---------------------------------------------------------------------------
// Preferences (key-value persistent storage)
// ---------------------------------------------------------------------------

export async function prefGet(key: string): Promise<string | null> {
  if (!isNativePlatform()) {
    return localStorage.getItem(key);
  }
  const { Preferences } = await import("@capacitor/preferences");
  const { value } = await Preferences.get({ key });
  return value;
}

export async function prefSet(key: string, value: string): Promise<void> {
  if (!isNativePlatform()) {
    localStorage.setItem(key, value);
    return;
  }
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key, value });
}

export async function prefRemove(key: string): Promise<void> {
  if (!isNativePlatform()) {
    localStorage.removeItem(key);
    return;
  }
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.remove({ key });
}
