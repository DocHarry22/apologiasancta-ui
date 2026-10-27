"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/native/AppIcon";
import { ResearchModeNav } from "./ResearchModeNav";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { GRAPH_EMBED_CHANNEL, graphAppDestination, graphFrameHref, graphOrigin, graphWebsiteHref } from "@/lib/graphEmbed";
import { GRAPH_BRIDGE_CHANNEL } from "@/lib/graphJourneys";
import { createGraphJourneyBridge } from "@/lib/graphJourneyBridge";
import styles from "./GraphExperience.module.css";

export default function GraphExperience({ navigation }: { navigation: string }) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<"loading" | "loaded" | "ready" | "slow" | "error">("loading");
  const [online, setOnline] = useState(true);
  const [account, setAccount] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const base = getResearchGraphUrl();
  const origin = graphOrigin(base);
  const website = graphWebsiteHref(base, navigation);
  const src = appOrigin ? graphFrameHref(base, navigation, appOrigin) : null;
  const currentHref = `/research/graph?${navigation}`;
  const retry = () => { setState("loading"); setAccount(""); setSignedOut(false); setRevision((value) => value + 1); };
  const initialize = useCallback(() => {
    if (origin) frame.current?.contentWindow?.postMessage({ channel: GRAPH_EMBED_CHANNEL, type: "init" }, origin);
  }, [origin]);

  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", escape); };
  }, [expanded]);

  useEffect(() => {
    setAppOrigin(window.location.origin);
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => { window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);

  useEffect(() => {
    if (!src || !origin || !frame.current?.contentWindow) return;
    const peer = frame.current.contentWindow;
    const bridge = createGraphJourneyBridge({ graphOrigin: origin, opener: peer, onState(next, message) {
      setSignedOut(next === "signed_out");
      setAccount(next === "connected" ? "" : message);
      if (next !== "connected") peer.postMessage({ channel: GRAPH_BRIDGE_CHANNEL, type: "unavailable", error: message }, origin);
    } });
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== peer) return;
      if (event.data?.channel === GRAPH_BRIDGE_CHANNEL) { void bridge.receive(event); return; }
      if (event.data?.channel !== GRAPH_EMBED_CHANNEL) return;
      if (event.data.type === "ready") setState("ready");
      if (event.data.type === "exit") router.push("/research");
      if (event.data.type === "open-app") {
        const destination = graphAppDestination(event.data.path);
        if (destination) router.push(destination);
      }
    };
    window.addEventListener("message", receive);
    const timeout = window.setTimeout(() => setState((current) => current === "loading" ? "slow" : current), 20000);
    return () => { window.clearTimeout(timeout); window.removeEventListener("message", receive); bridge.dispose(); };
  }, [src, origin, revision, router]);

  return <section className={`${styles.screen} ${expanded ? styles.expanded : ""}`} aria-label="Apologia Graph workspace">
    <header className={styles.toolbar}><div className={styles.heading}><Link href="/research" aria-label="Back to research"><AppIcon name="chevron" className="rotate-180" width={19} height={19} /></Link><div><h1>3D Galaxy</h1><p>Explore the live Apologia Graph.</p></div></div><div className={styles.actions}><button type="button" onClick={retry} aria-label="Reload Graph"><AppIcon name="research" width={18} height={18} /></button><button type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Collapse Graph" : "Expand Graph"} aria-pressed={expanded}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={expanded ? "M8 3v5H3m13-5v5h5M8 21v-5H3m13 5v-5h5" : "M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"} /></svg></button></div></header>
    <div className={styles.modes}><ResearchModeNav current="graph" /></div>
    {!online ? <div className={styles.notice} role="status"><p>You’re offline. Reconnect to load Graph and its sources.</p><button type="button" onClick={retry}>Try again</button></div> : null}
    {account ? <div className={styles.notice} role="status"><p>{account}</p>{signedOut ? <Link href={`/login?next=${encodeURIComponent(currentHref)}`}>Sign in to connect saves</Link> : null}</div> : null}
    {state === "slow" || state === "error" ? <div className={styles.notice} role="status"><p>{state === "error" ? "Graph couldn’t open. Try again or use the website." : "Graph is taking longer to load. You can retry or open the website."}</p><button type="button" onClick={retry}>Retry Graph</button></div> : null}
    <div className={styles.frame}>
      {src ? <iframe key={revision} ref={frame} src={src} title="Apologia Graph 3D engine" allow="clipboard-write" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { setState((current) => current === "ready" ? current : "loaded"); initialize(); }} onError={() => setState("error")} /> : null}
      {!origin || state === "loading" ? <div className={styles.loading} role="status"><AppIcon name="research" width={35} height={35} /><h2>{origin ? "Opening your galaxy…" : "Graph is unavailable."}</h2><p>{origin ? "Loading the graph, touch controls, and source inspector from Apologia Graph." : "The Graph website address is not configured correctly. Return to research and try again later."}</p></div> : null}
    </div>
    <div className={styles.footer}><span>Drag to rotate · Pinch to zoom</span>{website ? <a href={website} target="_blank" rel="noopener noreferrer" aria-label="Open Graph website">Website ↗</a> : null}<Link href="/research/journeys">Saved journeys</Link></div>
  </section>;
}
