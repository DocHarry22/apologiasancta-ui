"use client";

import { useEffect, useState } from "react";
import { NativeBottomTabs } from "./NativeBottomTabs";

export function CapacitorShell() {
  const [isCapacitor, setIsCapacitor] = useState(false);

  useEffect(() => {
    setIsCapacitor(!!(window as { Capacitor?: unknown }).Capacitor);
  }, []);

  if (!isCapacitor) return null;
  return <NativeBottomTabs />;
}
