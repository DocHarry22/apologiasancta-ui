"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SplashScreen } from "@capacitor/splash-screen";
import { NativeBottomTabs } from "./NativeBottomTabs";
import { StartupBootOverlay } from "@/components/startup/StartupBootOverlay";
import { isNativePlatform } from "@/lib/native";

const STARTUP_OVERLAY_MIN_MS = 1700;
const SPLASH_FAILSAFE_HIDE_MS = 4000;

export function CapacitorShell() {
  const pathname = usePathname();
  const currentPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const [isCapacitor, setIsCapacitor] = useState(false);
  const [showBootOverlay, setShowBootOverlay] = useState(false);
  const showNativeTabs =
    isCapacitor &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/author") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/api");
  const showAccountDeletionShortcut =
    isCapacitor && currentPath.startsWith("/account") && currentPath !== "/account/delete";

  useEffect(() => {
    const isNative = isNativePlatform();
    setIsCapacitor(isNative);
    setShowBootOverlay(isNative);

    if (!isNative) return;

    let cancelled = false;

    const minDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, STARTUP_OVERLAY_MIN_MS);
    });

    const waitForTwoFrames = new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    void Promise.all([minDelay, waitForTwoFrames]).then(() => {
      if (!cancelled) {
        setShowBootOverlay(false);
      }
    });

    // Defensive fallback to prevent stuck launch screen on slow startups.
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) {
        void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
        setShowBootOverlay(false);
      }
    }, SPLASH_FAILSAFE_HIDE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    if (!isCapacitor || showBootOverlay) return;
    void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
  }, [isCapacitor, showBootOverlay]);

  if (!isCapacitor) {
    return currentPath === "/native" ? <div className="lg:hidden"><NativeBottomTabs /></div> : null;
  }

  return (
    <>
      <StartupBootOverlay show={showBootOverlay} />
      {showAccountDeletionShortcut ? (
        <Link
          href="/account/delete"
          className="fixed right-4 z-50 rounded-full border border-(--danger) bg-(--surface-elevated) px-3 py-2 text-xs font-black text-(--danger) shadow-lg"
          style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          Delete account
        </Link>
      ) : null}
      {showNativeTabs && <NativeBottomTabs />}
    </>
  );
}
