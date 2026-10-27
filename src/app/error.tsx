"use client";

import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { ScreenSurface, ScreenIntro } from "@/components/native/ScreenSurface";
import { AppIcon } from "@/components/native/AppIcon";
import styles from "@/components/native/ScreenSurface.module.css";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <AppShell><ScreenSurface><ScreenIntro eyebrow="A moment to reconnect" title="Something interrupted your visit." accent="Let’s try again." description="We couldn’t open this screen. Try again, or return to your learning." /><section className={styles.card}><AppIcon name="signal" width={29} height={29} className="text-(--gold-hover)" /><h2 className="mt-4">Ready when you are.</h2><div className={styles.actions}><button type="button" className="btn-primary" onClick={retry}>Try again</button><Link className="btn-secondary" href="/learn">Back to learning</Link></div></section></ScreenSurface></AppShell>;
}
