import Link from "next/link";

const modes = [
  { href: "/research", label: "Constellations" },
  { href: "/research/timeline", label: "Timeline" },
  { href: "/research/compare", label: "Compare" },
  { href: "/research/debate", label: "Debate" },
] as const;

export function ResearchModeNav({ current }: { current: "constellations" | "timeline" | "compare" | "debate" }) {
  return (
    <nav aria-label="Research modes" className="flex flex-wrap gap-2">
      {modes.map((mode) => {
        const active = mode.label.toLowerCase() === current;
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
