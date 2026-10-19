"use client";

import { useEffect, useRef, useState } from "react";
import type { AppInfo } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { Dialog } from "@/components/ui/Dialog";
import {
  ANDROID_UPDATE_INTERVAL_MS, ANDROID_UPDATE_SNOOZE_KEY, ANDROID_UPDATE_SNOOZE_MS,
  isAndroidUpdateSnoozed, isNewerAndroidUpdate, parseAndroidUpdate, type AndroidUpdate,
} from "@/lib/androidUpdates";

export function AndroidUpdatePrompt() {
  const [available, setAvailable] = useState<{ update: AndroidUpdate; installed: AppInfo } | null>(null);
  const sessionSnooze = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let isActive = true;
    let installed: AppInfo | null = null;
    let resumeListener: PluginListenerHandle | undefined;
    let request: AbortController | null = null;
    let lastAttempt = -Infinity;

    const check = async () => {
      if (stopped || !isActive || !installed || request || document.visibilityState === "hidden" || !navigator.onLine || Date.now() - lastAttempt < 30000) return;
      lastAttempt = Date.now();
      const controller = new AbortController();
      request = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch("/api/android/updates", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        if (stopped) return;
        const update = parseAndroidUpdate(payload.update);
        if (!update || !isNewerAndroidUpdate(update, installed)) { setAvailable(null); return; }
        let snoozed = isAndroidUpdateSnoozed(update, sessionSnooze.current);
        try { snoozed ||= isAndroidUpdateSnoozed(update, localStorage.getItem(ANDROID_UPDATE_SNOOZE_KEY)); } catch { /* Storage is optional. */ }
        if (!snoozed) setAvailable({ update, installed });
      } catch { /* Offline checks must never block normal app use. */ }
      finally { window.clearTimeout(timeout); if (request === controller) request = null; }
    };

    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (stopped) return;
        installed = info;
        void check();
        const listener = await App.addListener("appStateChange", (state) => {
          isActive = state.isActive;
          if (isActive) void check();
        });
        if (stopped) void listener.remove(); else resumeListener = listener;
      } catch { /* Older APKs without the App plugin cannot report their installed version. */ }
    })();

    const recheck = () => { void check(); };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("online", recheck);
    const interval = window.setInterval(recheck, ANDROID_UPDATE_INTERVAL_MS);
    return () => {
      stopped = true;
      request?.abort();
      void resumeListener?.remove();
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("online", recheck);
      window.clearInterval(interval);
    };
  }, []);

  const dismiss = () => {
    if (available) {
      sessionSnooze.current = JSON.stringify({
        versionCode: available.update.versionCode, until: Date.now() + ANDROID_UPDATE_SNOOZE_MS,
      });
      try {
        localStorage.setItem(ANDROID_UPDATE_SNOOZE_KEY, sessionSnooze.current);
      } catch { /* Dismissal still works for this session. */ }
    }
    setAvailable(null);
  };

  if (!available) return null;
  return (
    <Dialog titleId="android-update-title" descriptionId="android-update-description" onClose={dismiss} className="max-h-[85dvh] max-w-md overflow-y-auto rounded-2xl p-6 text-(--text)">
      <h2 id="android-update-title" className="text-xl font-bold">App update available</h2>
      <p id="android-update-description" className="mt-3 text-sm leading-6 text-(--text-muted)">
        Apologia Sancta {available.update.versionName} is ready. You have version {available.installed.version}.
        Download the APK, then open it to install the update.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a className="btn-primary" href={available.update.apkUrl} target="_blank" rel="noopener noreferrer" onClick={dismiss}>Download update</a>
        <button className="btn-secondary" type="button" onClick={dismiss}>Later</button>
      </div>
      <p className="mt-3 text-xs text-(--text-muted)">Choose Later to be reminded after 24 hours.</p>
    </Dialog>
  );
}
