"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently redirects Capacitor (APK) users to /native.
 * Has no visual output — renders nothing.
 * In a normal web browser window.Capacitor is never defined, so
 * this component is a no-op for web users.
 */
export function CapacitorRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && !!(window as { Capacitor?: unknown }).Capacitor) {
      router.replace("/native");
    }
  }, [router]);

  return null;
}
