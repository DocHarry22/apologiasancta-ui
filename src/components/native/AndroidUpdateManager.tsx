"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchLatestAndroidUpdate,
  getInstalledAndroidVersion,
  isAndroidNative,
  openAndroidUpdate,
  openLegacyAndroidUpdate,
  validateAndroidUpdate,
  type AndroidInstalledVersion,
  type AndroidUpdateManifest,
} from "@/lib/androidUpdater";
import { prefGet, prefSet } from "@/lib/native";

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const LAST_CHECK_KEY = "android-updater-last-check";
const DISMISSED_VERSION_KEY = "android-updater-dismissed-version-code";

export function AndroidUpdateManager() {
  const [update, setUpdate] = useState<AndroidUpdateManifest | null>(null);
  const [installed, setInstalled] = useState<AndroidInstalledVersion | null>(null);
  const [opening, setOpening] = useState(false);
  const [installError, setInstallError] = useState("");
  const running = useRef(false);

  const checkForUpdate = useCallback(async (force = false) => {
    if (!isAndroidNative() || running.current) return;
    running.current = true;
    try {
      if (!force) {
        const lastRaw = await prefGet(LAST_CHECK_KEY);
        const last = Number(lastRaw || 0);
        if (Number.isFinite(last) && Date.now() - last < UPDATE_CHECK_INTERVAL_MS) return;
      }
      await prefSet(LAST_CHECK_KEY, String(Date.now()));
      const [current, latest] = await Promise.all([
        getInstalledAndroidVersion(),
        fetchLatestAndroidUpdate(),
      ]);
      setInstalled(current);
      setInstallError("");
      if (!current || !latest || latest.packageName !== current.packageName || latest.versionCode <= current.versionCode) {
        setUpdate(null);
        return;
      }
      const dismissed = Number(await prefGet(DISMISSED_VERSION_KEY) || 0);
      if (!force && dismissed === latest.versionCode) return;

      // Current binaries authenticate the actual release APK before the UI
      // advertises a direct same-package update. Play-installed copies are
      // recognized by the native plugin and remain Play-routed instead.
      if (current.nativeUpdaterAvailable) {
        const valid = await validateAndroidUpdate(latest, current);
        if (!valid) {
          setUpdate(null);
          return;
        }
      }
      setUpdate(latest);
    } catch {
      // Update checks must never prevent app startup or navigation. Validation
      // failures fail closed by withholding the update prompt.
      setUpdate(null);
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isAndroidNative()) return;
    const startupTimer = window.setTimeout(() => { void checkForUpdate(); }, 2600);
    const interval = window.setInterval(() => { void checkForUpdate(); }, UPDATE_CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(startupTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkForUpdate]);

  if (!update || !installed) return null;

  const legacy = !installed.nativeUpdaterAvailable;
  const playInstalled = installed.installerPackage === "com.android.vending";

  const dismiss = async () => {
    await prefSet(DISMISSED_VERSION_KEY, String(update.versionCode));
    setUpdate(null);
  };

  const install = async () => {
    if (opening || legacy) return;
    setOpening(true);
    setInstallError("");
    try {
      await openAndroidUpdate(update, installed);
    } catch {
      setInstallError("Android could not open the verified update destination. Try again, or use the official store/release page.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="android-update-title">
      <section className="w-full max-w-md rounded-[1.75rem] border border-(--border) bg-(--surface) p-5 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-(--surface-muted) text-2xl" aria-hidden="true">↻</div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--gold-hover)">Android update available</p>
            <h2 id="android-update-title" className="mt-1 text-xl font-bold text-(--text)">Apologia Sancta {update.versionName}</h2>
            <p className="mt-1 text-sm text-(--text-muted)">
              {legacy
                ? "This older app can detect the new release but cannot identify its original installer. Choose the same source you originally used so Android keeps the correct update/signing path."
                : playInstalled
                  ? `Installed: ${installed.versionName || "older version"}. This copy came from Google Play, so the update remains on the Play-managed signing and install path.`
                  : `Installed: ${installed.versionName || "older version"}. The actual release APK has been checked against this installed app before this prompt was shown.`}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-(--border) bg-(--surface-muted) p-3 text-sm text-(--text-muted)">
          <p><strong className="text-(--text)">Version code:</strong> {update.versionCode}</p>
          <p className="mt-1">
            {legacy
              ? "Google Play users should choose Google Play. Direct-APK users should choose the official release page for the one-time updater bootstrap."
              : playInstalled
                ? "Google Play remains responsible for validating and delivering the compatible signed update."
                : "Package name, versionCode, APK digest and signing certificate were verified before this direct-update prompt was displayed."}
          </p>
        </div>

        {installError ? <p className="mt-3 text-sm font-semibold text-(--danger)" role="alert">{installError}</p> : null}

        {legacy ? (
          <div className="mt-5 grid gap-3">
            <button type="button" onClick={() => openLegacyAndroidUpdate(update, "play")} className="min-h-12 rounded-xl bg-(--gold) px-4 font-bold text-[#17120a]">
              Update from Google Play
            </button>
            <button type="button" onClick={() => openLegacyAndroidUpdate(update, "release")} className="min-h-12 rounded-xl border border-(--border) px-4 font-semibold text-(--text)">
              Open official APK release page
            </button>
            <button type="button" onClick={() => void dismiss()} className="min-h-12 rounded-xl px-4 font-semibold text-(--text-muted)">Later</button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => void dismiss()} className="min-h-12 rounded-xl border border-(--border) px-4 font-semibold text-(--text)">Later</button>
            <button type="button" onClick={() => void install()} disabled={opening} className="min-h-12 rounded-xl bg-(--gold) px-4 font-bold text-[#17120a] disabled:opacity-60">
              {opening ? "Opening update…" : playInstalled ? "Open Google Play" : "Update now"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
