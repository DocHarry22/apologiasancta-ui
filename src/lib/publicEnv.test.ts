import { describe, expect, it } from "vitest";
import { resolveAndroidApkUrl } from "./publicEnv";

const OFFICIAL_APK =
  "https://github.com/DocHarry22/apologiasancta-ui/releases/latest/download/apologia-sancta.apk";

describe("resolveAndroidApkUrl", () => {
  it("pins production to the official signed GitHub release", () => {
    expect(resolveAndroidApkUrl(
      "https://sandybrown-bear-488955.hostingersite.com/downloads/apologia-sancta.apk",
      "production",
    )).toBe(OFFICIAL_APK);
    expect(resolveAndroidApkUrl("not-a-url", "production")).toBe(OFFICIAL_APK);
  });

  it("accepts official latest and versioned GitHub release assets", () => {
    expect(resolveAndroidApkUrl(OFFICIAL_APK, "production")).toBe(OFFICIAL_APK);
    const versioned =
      "https://github.com/DocHarry22/apologiasancta-ui/releases/download/android-v1.0.2/apologia-sancta.apk";
    expect(resolveAndroidApkUrl(versioned, "production")).toBe(versioned);
  });

  it("retains explicit non-production overrides for local testing", () => {
    const localOverride = "http://10.0.2.2:3000/apologia-sancta.apk";
    expect(resolveAndroidApkUrl(localOverride, "development")).toBe(localOverride);
  });
});
