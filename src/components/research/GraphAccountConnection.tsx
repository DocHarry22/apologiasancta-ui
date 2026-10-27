"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { createGraphJourneyBridge } from "@/lib/graphJourneyBridge";
import { ScreenSurface, ScreenIntro } from "@/components/native/ScreenSurface";
import { AppIcon } from "@/components/native/AppIcon";
import styles from "@/components/native/ScreenSurface.module.css";

export default function GraphAccountConnection() {
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("Connecting your learner account…");
  useEffect(() => {
    const base = getResearchGraphUrl();
    if (!window.opener || !base) {
      setState("error");
      setMessage("Open Graph and choose Connect learner account to start a connection.");
      return;
    }
    const bridge = createGraphJourneyBridge({
      graphOrigin: new URL(base).origin,
      opener: window.opener,
      onState(next, text) { setState(next); setMessage(text); },
    });
    const receive = (event: MessageEvent) => { void bridge.receive(event); };
    window.addEventListener("message", receive);
    void bridge.announce();
    return () => { window.removeEventListener("message", receive); bridge.dispose(); };
  }, []);

  return <ScreenSurface><ScreenIntro eyebrow="Your research, connected" title="Connect research saves" accent="Keep your discoveries close." /><section className={styles.card}>
    <AppIcon name="research" className="text-(--gold-hover)" width={28} height={28} /><p role="status">{message}</p>
    <p className="mt-4 text-sm leading-6 text-(--text-muted)">Paths and catalog bookmarks saved while connected are private journeys in your learner account, available on desktop and Android. Guest saves stay on the original device until you open and save them to your account.</p>
    <div className={styles.actions}>
      {state === "signed_out" && <Link className="btn-primary" href="/login?next=/research/graph-connect">Sign in</Link>}
      {state === "connected" && <button type="button" className="btn-primary" onClick={() => window.opener?.focus()}>Return to Graph</button>}
      {state === "error" && <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>Try again</button>}
      <Link className="btn-secondary" href="/research/journeys" target="_blank">Saved journeys</Link>
    </div>
  </section></ScreenSurface>;
}
