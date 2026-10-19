export const ANDROID_APPLICATION_ID = "com.apologiasancta.live";
export const ANDROID_RELEASES_URL = "https://github.com/DocHarry22/apologiasancta-ui/releases";
export const ANDROID_UPDATE_SNOOZE_KEY = "apologia-android-update-snooze";
export const ANDROID_UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;
export const ANDROID_UPDATE_INTERVAL_MS = 30 * 60 * 1000;

export interface AndroidUpdate {
  schemaVersion: 1;
  applicationId: string;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseUrl: string;
  apkSha256: string;
  signingCertSha256: string;
}

export function parseAndroidUpdate(value: unknown): AndroidUpdate | null {
  if (!value || typeof value !== "object") return null;
  const update = value as Record<string, unknown>;
  if (update.schemaVersion !== 1 || update.applicationId !== ANDROID_APPLICATION_ID ||
      !Number.isInteger(update.versionCode) || Number(update.versionCode) < 1 || Number(update.versionCode) > 2100000000 ||
      typeof update.versionName !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(update.versionName) ||
      typeof update.apkSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(update.apkSha256) ||
      typeof update.signingCertSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(update.signingCertSha256)) return null;
  const releaseUrl = `${ANDROID_RELEASES_URL}/tag/android-v${update.versionName}`;
  const apkUrl = `${ANDROID_RELEASES_URL}/download/android-v${update.versionName}/apologia-sancta.apk`;
  if (update.releaseUrl !== releaseUrl || update.apkUrl !== apkUrl) return null;
  return {
    schemaVersion: 1, applicationId: ANDROID_APPLICATION_ID,
    versionCode: Number(update.versionCode), versionName: update.versionName,
    releaseUrl, apkUrl, apkSha256: update.apkSha256, signingCertSha256: update.signingCertSha256,
  };
}

export function isNewerAndroidUpdate(update: AndroidUpdate, installed: { id: string; build: string }): boolean {
  return installed.id === update.applicationId && /^[1-9]\d*$/.test(installed.build) &&
    Number.isSafeInteger(Number(installed.build)) && update.versionCode > Number(installed.build);
}

export function isAndroidUpdateSnoozed(update: AndroidUpdate, stored: string | null, now = Date.now()): boolean {
  try {
    const snooze = JSON.parse(stored ?? "null");
    return snooze?.versionCode === update.versionCode && Number.isFinite(snooze.until) &&
      snooze.until > now && snooze.until <= now + ANDROID_UPDATE_SNOOZE_MS;
  } catch { return false; }
}
