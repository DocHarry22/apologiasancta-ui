"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNativePlatform } from "@/lib/native";

/**
 * Sends the website entry point to the Android home without intercepting
 * deep links or navigation to other application screens.
 * Has no visual output — renders nothing.
 * Capacitor also exposes a web shim in browsers, so platform detection must
 * use the bridge's native-platform signal rather than global presence alone.
 */
export function CapacitorRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/" && isNativePlatform()) {
      router.replace("/native");
    }
  }, [pathname, router]);

  return null;
}
