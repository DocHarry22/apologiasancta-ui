"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

export type AndroidInstalledVersion = {
  packageName: string;
  versionCode: number;
  versionName: string;
  installerPackage?: string | null;
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
};

type AppUpdaterPlugin = {
  getInstalledVersion(): Promise<AndroidInstalledVersion>;
  openUpdate(options: { apkUrl: string; releaseUrl: string; packageName: string }): Promise<{ opened: boolean; destination: string }>;
};

const AppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function getInstalledAndroidVersion(): Promise<AndroidInstalledVersion | null> {
  if (!isAndroidNative()) return null;
  try {
    return await AppUpdater.getInstalledVersion();
  } catch {
    // Older APKs do not contain the updater plugin. Returning a legacy marker
    // lets the remotely served UI offer the one-time bootstrap update anyway.
    return { packageName: "com.apologiasancta.live", versionCode: 0, versionName: "legacy", installerPackage: null };
  }
}

export async function fetchLatestAndroidUpdate(): Promise<AndroidUpdateManifest | null> {
  const response = await fetch("/api/android/update", { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Android update service is unavailable");
  const body = await response.json() as { available?: unknown; update?: unknown };
  if (body.available !== true || !body.update || typeof body.update !== "object") return null;
  const update = body.update as AndroidUpdateManifest;
  if (update.packageName !== "com.apologiasancta.live" || !Number.isInteger(update.versionCode) || update.versionCode < 1) {
    throw new Error("Android update metadata is invalid");
  }
  return update;
}

export async function openAndroidUpdate(update: AndroidUpdateManifest): Promise<void> {
  if (!isAndroidNative()) return;
  try {
    await AppUpdater.openUpdate({
      apkUrl: update.apkUrl,
      releaseUrl: update.releaseUrl,
      packageName: update.packageName,
    });
    return;
  } catch {
    // Bootstrap path for an APK installed before the native updater plugin
    // existed. Android will still enforce package name + signing identity when
    // the downloaded APK is installed over the existing application.
    window.open(update.apkUrl, "_blank", "noopener,noreferrer");
  }
}
