import { AppShell } from "@/components/shell/AppShell";
import { ScreenSurface, ScreenIntro } from "@/components/native/ScreenSurface";

export default function Loading() {
  return <AppShell><ScreenSurface><ScreenIntro eyebrow="Your journey continues" title="A moment to prepare." accent="More to discover." /><div role="status" aria-label="Loading this screen" className="grid gap-4 motion-safe:animate-pulse"><span className="sr-only">Loading this screen…</span>{[0, 1, 2].map(item => <div key={item} aria-hidden="true" className="surface-card min-h-24 rounded-2xl p-5"><div className="h-4 w-2/3 rounded bg-(--border)" /><div className="mt-4 h-3 w-5/6 rounded bg-(--border)" /></div>)}</div></ScreenSurface></AppShell>;
}
