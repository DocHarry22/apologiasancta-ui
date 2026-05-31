/**
 * Native Capacitor utilities — all functions are no-ops on web.
 * Import from here instead of directly from Capacitor plugins so
 * SSR and web builds never break.
 */

function isCapacitor(): boolean {
  return typeof window !== "undefined" && !!(window as { Capacitor?: unknown }).Capacitor;
}

// ---------------------------------------------------------------------------
// Haptics
// ---------------------------------------------------------------------------

export async function hapticSuccess(): Promise<void> {
  if (!isCapacitor()) return;
  const { Haptics, NotificationType } = await import("@capacitor/haptics");
  await Haptics.notification({ type: NotificationType.Success });
}

export async function hapticError(): Promise<void> {
  if (!isCapacitor()) return;
  const { Haptics, NotificationType } = await import("@capacitor/haptics");
  await Haptics.notification({ type: NotificationType.Error });
}

export async function hapticLight(): Promise<void> {
  if (!isCapacitor()) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Light });
}

// ---------------------------------------------------------------------------
// Keep screen awake
// ---------------------------------------------------------------------------

export async function keepAwake(): Promise<void> {
  if (!isCapacitor()) return;
  const { KeepScreenOn } = await import("capacitor-keep-screen-on");
  await KeepScreenOn.enable();
}

export async function allowSleep(): Promise<void> {
  if (!isCapacitor()) return;
  const { KeepScreenOn } = await import("capacitor-keep-screen-on");
  await KeepScreenOn.disable();
}

// ---------------------------------------------------------------------------
// Preferences (key-value persistent storage)
// ---------------------------------------------------------------------------

export async function prefGet(key: string): Promise<string | null> {
  if (!isCapacitor()) {
    return localStorage.getItem(key);
  }
  const { Preferences } = await import("@capacitor/preferences");
  const { value } = await Preferences.get({ key });
  return value;
}

export async function prefSet(key: string, value: string): Promise<void> {
  if (!isCapacitor()) {
    localStorage.setItem(key, value);
    return;
  }
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key, value });
}

export async function prefRemove(key: string): Promise<void> {
  if (!isCapacitor()) {
    localStorage.removeItem(key);
    return;
  }
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.remove({ key });
}
