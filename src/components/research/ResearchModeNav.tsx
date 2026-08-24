import Link from "next/link";

const modes = [
  { href: "/research", label: "Constellations", id: "constellations" },
  { href: "/research/timeline", label: "Timeline", id: "timeline" },
  { href: "/research/compare", label: "Compare", id: "compare" },
  { href: "/research/debate", label: "Debate", id: "debate" },
  { href: "/research/journeys", label: "Saved", id: "saved" },
] as const;

export function ResearchModeNav({ current }: { current: "constellations" | "timeline" | "compare" | "debate" | "saved" }) {
  return (
    <nav aria-label="Research modes" className="flex flex-wrap gap-2">
      {modes.map((mode) => {
        const active = mode.id === current;
        return (
          <Link
            key={mode.href}
            href={mode.href}
            aria-current={active ? "page" : undefined}
            className={active ? "btn-primary px-3 py-2" : "btn-quiet px-3 py-2"}
          >
            {mode.label}
          </Link>
        );
      })}
    </nav>
  );
}
