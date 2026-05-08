const DEFAULT_ENGINE_URL = "https://apologiasancta-engine.onrender.com";
const DEFAULT_ANDROID_APK_URL = "/downloads/apologia-sancta.apk";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL?.trim() || DEFAULT_ENGINE_URL;
const ANDROID_APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() || DEFAULT_ANDROID_APK_URL;

export function getEngineUrl(): string | null {
  return ENGINE_URL;
}

export function isEngineConfigured(): boolean {
  return ENGINE_URL.length > 0;
}

export function getAndroidApkUrl(): string | null {
  return ANDROID_APK_URL;
}
