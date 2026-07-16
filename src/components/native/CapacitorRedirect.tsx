"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativePlatform } from "@/lib/native";

/**
 * Silently redirects Capacitor (APK) users to /native.
 * Has no visual output — renders nothing.
 * Capacitor also exposes a web shim in browsers, so platform detection must
 * use the bridge's native-platform signal rather than global presence alone.
 */
export function CapacitorRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (isNativePlatform()) {
      router.replace("/native");
    }
  }, [router]);

  return null;
}
