"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

const EXPECTED_PACKAGE = "com.apologiasancta.live";
const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${EXPECTED_PACKAGE}`;
const ASSET_API_PREFIX = "https://api.github.com/repos/DocHarry22/apologiasancta-ui/releases/assets/";
const RELEASE_URL_PATTERN = /^https:\/\/github\.com\/DocHarry22\/apologiasancta-ui\/releases\/tag\/android-v[0-9A-Za-z._-]+$/;

export type AndroidInstalledVersion = {
  packageName: string;
  versionCode: number;
  versionName: string;
  installerPackage?: string | null;
  nativeUpdaterAvailable: boolean;
};

export type AndroidUpdateManifest = {
  schemaVersion: number;
  packageName: string;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseUrl: string;
  sha256: string;
  publishedAt: string;
  apkAssetId: number;
  apkAssetApiUrl: string;
};

type AppUpdaterPlugin = {
  getInstalledVersion(): Promise<AndroidInstalledVersion>;
  validateUpdate(options: {
    packageName: string;
    versionCode: number;
    sha256: string;
    apkAssetApiUrl: string;
  }): Promise<{ valid: boolean; destination: string }>;
  openUpdate(options: {
    apkUrl: string;
    releaseUrl: string;
    packageName: string;
    versionCode: number;
    sha256: string;
    apkAssetApiUrl: string;
  }): Promise<{ opened: boolean; destination: string }>;
};

const AppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function getInstalledAndroidVersion(): Promise<AndroidInstalledVersion | null> {
  if (!isAndroidNative()) return null;
  try {
    const installed = await AppUpdater.getInstalledVersion();
    return { ...installed, nativeUpdaterAvailable: true };
  } catch {
    // APKs installed before the updater bridge existed can still receive the
    // live web prompt, but they must choose a safe official destination rather
    // than being silently routed to a sideloaded APK.
    return {
      packageName: EXPECTED_PACKAGE,
      versionCode: 0,
      versionName: "legacy",
      installerPackage: null,
      nativeUpdaterAvailable: false,
    };
  }
}

function validUpdateShape(value: unknown): value is AndroidUpdateManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const update = value as AndroidUpdateManifest;
  if (update.schemaVersion !== 1 || update.packageName !== EXPECTED_PACKAGE) return false;
  if (!Number.isSafeInteger(update.versionCode) || update.versionCode < 1) return false;
  if (!Number.isSafeInteger(update.apkAssetId) || update.apkAssetId < 1) return false;
  if (!/^[0-9A-Za-z._-]+$/.test(update.versionName)) return false;
  if (!/^[a-f0-9]{64}$/i.test(update.sha256)) return false;
  if (!RELEASE_URL_PATTERN.test(update.releaseUrl)) return false;
  if (update.apkAssetApiUrl !== `${ASSET_API_PREFIX}${update.apkAssetId}`) return false;
  if (Number.isNaN(Date.parse(update.publishedAt))) return false;
  try {
    const download = new URL(update.apkUrl);
    if (download.origin !== window.location.origin || download.pathname !== "/api/android/update/apk") return false;
    if (download.searchParams.get("assetId") !== String(update.apkAssetId)) return false;
    if (download.searchParams.get("sha256")?.toLowerCase() !== update.sha256.toLowerCase()) return false;
  } catch {
    return false;
  }
  return true;
}

export async function fetchLatestAndroidUpdate(): Promise<AndroidUpdateManifest | null> {
  const response = await fetch("/api/android/update", { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Android update service is unavailable");
  const body = await response.json() as { available?: unknown; update?: unknown };
  if (body.available !== true || !body.update) return null;
  if (!validUpdateShape(body.update)) throw new Error("Android update metadata is invalid");
  return body.update;
}

export async function validateAndroidUpdate(
  update: AndroidUpdateManifest,
  installed: AndroidInstalledVersion,
): Promise<boolean> {
  if (!isAndroidNative() || !installed.nativeUpdaterAvailable) return false;
  const result = await AppUpdater.validateUpdate({
    packageName: update.packageName,
    versionCode: update.versionCode,
    sha256: update.sha256,
    apkAssetApiUrl: update.apkAssetApiUrl,
  });
  return result.valid === true;
}

export async function openAndroidUpdate(
  update: AndroidUpdateManifest,
  installed: AndroidInstalledVersion,
): Promise<void> {
  if (!isAndroidNative() || !installed.nativeUpdaterAvailable) {
    throw new Error("Native Android updater is unavailable");
  }
  // Do not fall back on arbitrary native errors. Package/URL/signature failures
  // must remain fail-closed, especially for Play-installed copies.
  await AppUpdater.openUpdate({
    apkUrl: update.apkUrl,
    releaseUrl: update.releaseUrl,
    packageName: update.packageName,
    versionCode: update.versionCode,
    sha256: update.sha256,
    apkAssetApiUrl: update.apkAssetApiUrl,
  });
}

export function openLegacyAndroidUpdate(
  update: AndroidUpdateManifest,
  destination: "play" | "release",
): void {
  const url = destination === "play" ? PLAY_STORE_WEB_URL : update.releaseUrl;
  window.open(url, "_blank", "noopener,noreferrer");
}
