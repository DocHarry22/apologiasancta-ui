const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL?.trim() || null;
const ANDROID_APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() || null;

export function getEngineUrl(): string | null {
  return ENGINE_URL;
}

export function isEngineConfigured(): boolean {
  return ENGINE_URL !== null;
}

export function getAndroidApkUrl(): string | null {
  return ANDROID_APK_URL;
}
