import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ANDROID_APPLICATION_ID, ANDROID_RELEASES_URL, ANDROID_UPDATE_SNOOZE_MS, isAndroidUpdateSnoozed, isNewerAndroidUpdate, parseAndroidUpdate } from "./androidUpdates";

const { createAndroidUpdate, validateAndroidUpgrade } = createRequire(import.meta.url)("../../scripts/write-android-update.cjs");
const badging = (code = 4, name = "1.0.4") => `package: name='${ANDROID_APPLICATION_ID}' versionCode='${code}' versionName='${name}'`;
const verification = (cert = "a".repeat(64)) => `Signer #1 certificate DN: CN=Apologia Sancta\nSigner #1 certificate SHA-256 digest: ${cert}\n`;
const makeUpdate = () => createAndroidUpdate({ badging: badging(), verification: verification(), apkSha256: "b".repeat(64), releaseTag: "android-v1.0.4" });

describe("Android update identity and release gate", () => {
  it("round-trips verified APK metadata into the client schema", () => {
    expect(parseAndroidUpdate(makeUpdate())).toMatchObject({ versionCode: 4, versionName: "1.0.4", applicationId: ANDROID_APPLICATION_ID });
  });
  it("uses build codes and application identity rather than the website version", () => {
    const update = makeUpdate();
    expect(isNewerAndroidUpdate(update, { id: ANDROID_APPLICATION_ID, build: "3" })).toBe(true);
    for (const build of ["4", "5", "", "NaN", "3.5", "3junk"]) expect(isNewerAndroidUpdate(update, { id: ANDROID_APPLICATION_ID, build })).toBe(false);
    expect(isNewerAndroidUpdate(update, { id: "another.app", build: "3" })).toBe(false);
  });
  it("rejects untrusted downloads, mismatched versions, and malformed metadata", () => {
    for (const patch of [
      { apkUrl: "https://evil.test/update.apk" }, { apkUrl: `${ANDROID_RELEASES_URL}/latest/download/apologia-sancta.apk` },
      { applicationId: "another.app" }, { versionName: "1.0.5" }, { versionCode: "4" },
      { versionCode: 0 }, { versionCode: 2100000001 }, { apkSha256: "bad" }, { signingCertSha256: "" }, { schemaVersion: 2 },
    ]) expect(parseAndroidUpdate({ ...makeUpdate(), ...patch })).toBeNull();
    expect(parseAndroidUpdate(null)).toBeNull();
  });
  it("snoozes only that version for a bounded 24 hours", () => {
    const until = 1000 + ANDROID_UPDATE_SNOOZE_MS;
    expect(isAndroidUpdateSnoozed(makeUpdate(), JSON.stringify({ versionCode: 4, until }), 1000)).toBe(true);
    expect(isAndroidUpdateSnoozed(makeUpdate(), JSON.stringify({ versionCode: 3, until }), 1000)).toBe(false);
    expect(isAndroidUpdateSnoozed(makeUpdate(), JSON.stringify({ versionCode: 4, until }), until)).toBe(false);
    expect(isAndroidUpdateSnoozed(makeUpdate(), JSON.stringify({ versionCode: 4, until: until + 1 }), 1000)).toBe(false);
    expect(isAndroidUpdateSnoozed(makeUpdate(), "not json", 1000)).toBe(false);
  });
  it("refuses release metadata for a wrong package, debug signer, or tag", () => {
    const args = { badging: badging(), verification: verification(), apkSha256: "b".repeat(64), releaseTag: "android-v1.0.4" };
    expect(() => createAndroidUpdate({ ...args, releaseTag: "android-v1.0.5" })).toThrow();
    expect(() => createAndroidUpdate({ ...args, badging: badging().replace(ANDROID_APPLICATION_ID, "another.app") })).toThrow();
    expect(() => createAndroidUpdate({ ...args, verification: verification().replace("CN=Apologia Sancta", "CN=Android Debug") })).toThrow();
  });
  it("allows an in-place upgrade and refuses changed certificates or non-increasing codes", () => {
    expect(() => validateAndroidUpgrade({ previousBadging: badging(3, "1.0.3"), previousVerification: verification(), update: makeUpdate() })).not.toThrow();
    expect(() => validateAndroidUpgrade({ previousBadging: badging(3, "1.0.3"), previousVerification: verification("c".repeat(64)), update: makeUpdate() })).toThrow(/signing identity/);
    for (const code of [4, 5]) expect(() => validateAndroidUpgrade({ previousBadging: badging(code), previousVerification: verification(), update: makeUpdate() })).toThrow(/versionCode/);
  });
});
