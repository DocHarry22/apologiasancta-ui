"use client";

import Link from "next/link";

interface Topic {
  id: string;
  title: string;
  questionCount: number;
}

interface TopicsScrollProps {
  topics: Topic[];
}

/** Map topic ids to a simple icon path (SVG) string */
function topicIcon(id: string): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    christology: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M11 2h2v8h8v2h-8v8h-2v-8H3v-2h8V2z" />
      </svg>
    ),
    church_history: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M16 10v11M12 6v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    genesis: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2C8 6 8 10 12 12s4 6 0 10" strokeLinecap="round" />
        <path d="M2 12h20" strokeLinecap="round" />
      </svg>
    ),
    trinity: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M12 3l9 16H3L12 3z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    mariology: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
        <path d="M12 14c-5.523 0-8 2.239-8 5v1h16v-1c0-2.761-2.477-5-8-5z" strokeLinecap="round" />
      </svg>
    ),
    scripture_tradition: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    apologetics: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    romans: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };
  return (
    iconMap[id] ?? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  );
}

export function TopicsScroll({ topics }: TopicsScrollProps) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
    >
      {topics.map((topic) => (
        <Link
          key={topic.id}
          href={`/library?topic=${topic.id}`}
          className="flex shrink-0 flex-col gap-2 rounded-xl p-3 transition-opacity hover:opacity-80 active:opacity-60"
          style={{
            width: "120px",
            background: "rgba(36,34,32,0.9)",
            border: "1px solid rgba(212,175,55,0.18)",
          }}
        >
          {/* Icon circle */}
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#d4af37]"
            style={{ background: "rgba(212,175,55,0.12)" }}
          >
            {topicIcon(topic.id)}
          </div>

          {/* Title */}
          <span className="text-[13px] font-semibold leading-tight text-[#f4efe5]">
            {topic.title}
          </span>

          {/* Article count */}
          <span className="text-[11px] text-[#9c917f]">
            {topic.questionCount} Articles
          </span>

          {/* Gold underline accent */}
          <div
            className="mt-auto h-0.5 w-8 rounded-full"
            style={{ background: "linear-gradient(90deg, #d4af37, transparent)" }}
          />
        </Link>
      ))}
    </div>
  );
}
