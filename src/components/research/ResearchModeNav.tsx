import Link from "next/link";
import { AppIcon, type AppIconName } from "@/components/native/AppIcon";
import styles from "./ResearchUI.module.css";

const modes = [
  { href: "/research", label: "Explore", id: "constellations" },
  { href: "/research/graph", label: "3D Galaxy", id: "graph" },
  { href: "/research/agent", label: "AI studies", id: "agent" },
  { href: "/research/timeline", label: "Timeline", id: "timeline" },
  { href: "/research/compare", label: "Compare", id: "compare" },
  { href: "/research/debate", label: "Debate", id: "debate" },
  { href: "/research/journeys", label: "Saved", id: "saved" },
] as const;

export type ResearchMode = typeof modes[number]["id"];
const icons: Record<ResearchMode, AppIconName> = { constellations: "research", graph: "research", agent: "spark", timeline: "timeline", compare: "compare", debate: "chat", saved: "bookmark" };

export function ResearchModeNav({ current }: { current: ResearchMode }) {
  return (
    <nav aria-label="Research modes" className={styles.modes}>
      {modes.map((mode) => {
        const active = mode.id === current;
        return (
          <Link
            key={mode.href}
            href={mode.href}
            aria-current={active ? "page" : undefined}
            className={styles.mode}
          >
            <AppIcon name={icons[mode.id]} width={19} height={19} />{mode.label}
          </Link>
        );
      })}
    </nav>
  );
}
