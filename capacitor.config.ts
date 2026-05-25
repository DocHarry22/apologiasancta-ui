import type { CapacitorConfig } from "@capacitor/cli";

// ---------------------------------------------------------------------------
// Build mode
// ---------------------------------------------------------------------------
//
// Set CAPACITOR_BUILD_MODE=production for release / CI builds.
// Falls back to NODE_ENV, then "development".
//
// Production mode:
//   - CAPACITOR_SERVER_URL or NEXT_PUBLIC_APP_URL must be set.
//   - URL must use HTTPS.
//   - localhost, 127.0.0.1, and temporary preview domains are rejected.
//   - Missing or invalid URL throws immediately so the build fails loudly.
//
// Development mode:
//   - Missing URL falls back to http://localhost:3000 with a warning.
//   - Cleartext HTTP is allowed so the dev server works over LAN.
//
const buildMode =
  process.env.CAPACITOR_BUILD_MODE ??
  process.env.NODE_ENV ??
  "development";

const isProduction = buildMode === "production";

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/** Hostnames / patterns that must never appear in a production APK. */
const FORBIDDEN_PROD_HOSTNAMES = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /hostingersite\.com$/i,
];

function validateProductionUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `[capacitor.config] PRODUCTION BUILD FAILED — invalid URL: "${url}". ` +
        "Set CAPACITOR_SERVER_URL to a valid HTTPS URL before building a release APK."
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `[capacitor.config] PRODUCTION BUILD FAILED — URL must use HTTPS. Got: "${url}". ` +
        "Set CAPACITOR_SERVER_URL to your production HTTPS URL."
    );
  }

  for (const pattern of FORBIDDEN_PROD_HOSTNAMES) {
    if (pattern.test(parsed.hostname)) {
      throw new Error(
        `[capacitor.config] PRODUCTION BUILD FAILED — forbidden host in production URL: ` +
          `"${parsed.hostname}". localhost, 127.0.0.1, and temporary preview domains ` +
          "are not allowed in release builds."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Server URL resolution
// ---------------------------------------------------------------------------

const DEV_FALLBACK_URL = "http://localhost:3000";

const configuredUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "";

let serverUrl: string;

if (isProduction) {
  if (!configuredUrl) {
    throw new Error(
      "[capacitor.config] PRODUCTION BUILD FAILED — Neither CAPACITOR_SERVER_URL nor " +
        "NEXT_PUBLIC_APP_URL is set. Set CAPACITOR_SERVER_URL to your production HTTPS URL " +
        "before building a release APK."
    );
  }
  validateProductionUrl(configuredUrl);
  serverUrl = configuredUrl;
} else {
  if (!configuredUrl) {
    console.warn(
      "[capacitor.config] WARNING: Neither CAPACITOR_SERVER_URL nor NEXT_PUBLIC_APP_URL " +
        `is set. Using development fallback ${DEV_FALLBACK_URL}. ` +
        "Set CAPACITOR_BUILD_MODE=production and CAPACITOR_SERVER_URL before building a release APK."
    );
    serverUrl = DEV_FALLBACK_URL;
  } else {
    serverUrl = configuredUrl;
  }
}

// ---------------------------------------------------------------------------
// Cleartext and mixed content
// ---------------------------------------------------------------------------
// Only permitted for explicit local / HTTP development URLs.
// Production URLs always use HTTPS so these are always false in production.

const usesCleartextServer = serverUrl.startsWith("http://");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const config: CapacitorConfig = {
  appId: "com.apologiasancta.live",
  appName: "Apologia Sancta",
  webDir: "capacitor-shell",
  server: {
    url: serverUrl,
    cleartext: usesCleartextServer,
    androidScheme: usesCleartextServer ? "http" : "https",
  },
  android: {
    allowMixedContent: usesCleartextServer,
  },
};

export default config;
