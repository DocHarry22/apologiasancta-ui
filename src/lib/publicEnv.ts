const DEFAULT_ENGINE_URL = "https://apologiasancta-engine.onrender.com";
const DEFAULT_ANDROID_APK_URL =
  "https://github.com/DocHarry22/apologiasancta-ui/releases/latest/download/apologia-sancta.apk";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL?.trim() || DEFAULT_ENGINE_URL;
const ANDROID_APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() || DEFAULT_ANDROID_APK_URL;

/**
 * Returns the engine URL. On the client inside a Capacitor APK, rewrites
 * localhost/127.0.0.1 → 10.0.2.2 so the Android emulator/device can reach
 * the host machine's dev server.
 */
export function getEngineUrl(): string | null {
  if (typeof window !== "undefined" && (window as { Capacitor?: unknown }).Capacitor) {
    return ENGINE_URL.replace(/localhost|127\.0\.0\.1/, "10.0.2.2");
  }
  return ENGINE_URL;
}

export function isEngineConfigured(): boolean {
  return ENGINE_URL.length > 0;
}

export function getAndroidApkUrl(): string | null {
  return ANDROID_APK_URL;
}
