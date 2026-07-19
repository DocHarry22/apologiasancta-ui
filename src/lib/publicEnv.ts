import { isNativePlatform } from "@/lib/native";

const DEFAULT_ENGINE_URL = "https://apologiasancta-engine.onrender.com";
const DEFAULT_ANDROID_APK_URL =
  "https://github.com/DocHarry22/apologiasancta-ui/releases/latest/download/apologia-sancta.apk";
const DEFAULT_RESEARCH_GRAPH_URL =
  "https://mediumvioletred-kingfisher-797460.hostingersite.com";

const OFFICIAL_ANDROID_RELEASE_PATH =
  "/DocHarry22/apologiasancta-ui/releases/";

/**
 * Production must never advertise a locally hosted debug APK. Hostinger used
 * to override the official release URL with /downloads/apologia-sancta.apk,
 * which can be useful for development but bypasses the signed-release gate.
 */
export function resolveAndroidApkUrl(
  configuredUrl: string | undefined,
  environment: string | undefined,
): string {
  const candidate = configuredUrl?.trim();
  if (!candidate) return DEFAULT_ANDROID_APK_URL;
  if (environment !== "production") return candidate;

  try {
    const parsed = new URL(candidate);
    const isOfficialRelease =
      parsed.protocol === "https:" &&
      parsed.hostname === "github.com" &&
      parsed.pathname.startsWith(OFFICIAL_ANDROID_RELEASE_PATH) &&
      parsed.pathname.endsWith("/apologia-sancta.apk");
    return isOfficialRelease ? candidate : DEFAULT_ANDROID_APK_URL;
  } catch {
    return DEFAULT_ANDROID_APK_URL;
  }
}

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL?.trim() || DEFAULT_ENGINE_URL;
const ANDROID_APK_URL = resolveAndroidApkUrl(
  process.env.NEXT_PUBLIC_ANDROID_APK_URL,
  process.env.NODE_ENV,
);
const RESEARCH_GRAPH_URL =
  process.env.NEXT_PUBLIC_RESEARCH_GRAPH_URL?.trim() || DEFAULT_RESEARCH_GRAPH_URL;

/**
 * Returns the engine URL. On the client inside a Capacitor APK, rewrites
 * localhost/127.0.0.1 → 10.0.2.2 so the Android emulator/device can reach
 * the host machine's dev server.
 */
export function getEngineUrl(): string | null {
  if (isNativePlatform()) {
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

export function getResearchGraphUrl(): string | null {
  return RESEARCH_GRAPH_URL;
}
