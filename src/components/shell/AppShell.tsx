import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { GraphPromoBanner } from "./GraphPromoBanner";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { SiteFooter } from "./SiteFooter";
import { CapacitorRedirect } from "@/components/native/CapacitorRedirect";

export function AppShell({ children, footer = true, mobileNavigation = true }: { children: ReactNode; footer?: boolean; mobileNavigation?: boolean }) {
  return (
    <div className="site-shell">
      {mobileNavigation ? <CapacitorRedirect /> : null}
      <GraphPromoBanner />
      <AppHeader />
      <main id="main-content">{children}</main>
      {footer ? <SiteFooter /> : null}
      {mobileNavigation ? <MobileBottomNavigation /> : null}
    </div>
  );
}
