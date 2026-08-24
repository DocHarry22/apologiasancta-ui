"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchLatestAndroidUpdate,
  getInstalledAndroidVersion,
  isAndroidNative,
  openAndroidUpdate,
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
      if (!current || !latest || latest.packageName !== current.packageName || latest.versionCode <= current.versionCode) {
        setUpdate(null);
        return;
      }
      const dismissed = Number(await prefGet(DISMISSED_VERSION_KEY) || 0);
      if (!force && dismissed === latest.versionCode) return;
      setUpdate(latest);
    } catch {
      // Update checks must never prevent app startup or navigation.
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

  if (!update) return null;

  const dismiss = async () => {
    await prefSet(DISMISSED_VERSION_KEY, String(update.versionCode));
    setUpdate(null);
  };

  const install = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await openAndroidUpdate(update);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="android-update-title">
      <section className="w-full max-w-md rounded-[1.75rem] border border-(--border) bg-(--surface) p-5 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-(--gold)/15 text-2xl" aria-hidden="true">↻</div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--gold-hover)">Android update available</p>
            <h2 id="android-update-title" className="mt-1 text-xl font-bold text-(--text)">Apologia Sancta {update.versionName}</h2>
            <p className="mt-1 text-sm text-(--text-muted)">
              Installed: {installed?.versionName || "older version"}. This update uses the same app identity, so Android upgrades this installation instead of creating a second Apologia Sancta app.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-(--border) bg-(--surface-muted) p-3 text-sm text-(--text-muted)">
          <p><strong className="text-(--text)">Version code:</strong> {update.versionCode}</p>
          <p className="mt-1">Android will verify the existing package/signing identity before replacing the installed version.</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => void dismiss()} className="min-h-12 rounded-xl border border-(--border) px-4 font-semibold text-(--text)">Later</button>
          <button type="button" onClick={() => void install()} disabled={opening} className="min-h-12 rounded-xl bg-(--gold) px-4 font-bold text-[#17120a] disabled:opacity-60">
            {opening ? "Opening update…" : "Update now"}
          </button>
        </div>
      </section>
    </div>
  );
}
