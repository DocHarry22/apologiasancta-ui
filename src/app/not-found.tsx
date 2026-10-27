import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { ScreenSurface, ScreenIntro } from "@/components/native/ScreenSurface";
import { AppIcon } from "@/components/native/AppIcon";
import styles from "@/components/native/ScreenSurface.module.css";

export default function NotFound() {
  return <AppShell><ScreenSurface><ScreenIntro eyebrow="A different path" title="Page not found" accent="There’s more to explore." description="This page may have moved or the link may be incomplete. Return to your learning and keep exploring." /><section className={styles.card}><AppIcon name="book" width={29} height={29} className="text-(--gold-hover)" /><h2 className="mt-4">Find your next step.</h2><div className={styles.actions}><Link className="btn-primary" href="/native">Back to home</Link><Link className="btn-secondary" href="/learn">Explore learning</Link></div></section></ScreenSurface></AppShell>;
}
