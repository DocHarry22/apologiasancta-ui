import type { SVGProps } from "react";

export type AppIconName = "home" | "book" | "play" | "library" | "account" | "arrow" | "search" | "research" | "trophy" | "spark" | "signal" | "cross" | "bookmark" | "lock" | "check" | "chevron" | "filter" | "grid" | "list" | "shield" | "bell" | "mail" | "timeline" | "compare" | "chat";

const paths: Record<AppIconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  book: <><path d="M12 5v16M3 4h4a7 7 0 0 1 5 2 7 7 0 0 1 5-2h4v15h-4a7 7 0 0 0-5 2 7 7 0 0 0-5-2H3Z" /><path d="M6 8h2m-2 4h2m8-4h2m-2 4h2" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" /></>,
  library: <><path d="M4 3h4v18H4Zm6 0h4v18h-4Zm7 1 4-1 3 17-4 1Z" transform="translate(-1 0)" /><path d="M3 7h4m2 0h4" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  research: <><circle cx="12" cy="4" r="2.5" /><circle cx="4" cy="19" r="2.5" /><circle cx="20" cy="19" r="2.5" /><path d="m11 6-6 10m8-10 6 10M7 19h10" /></>,
  trophy: <><path d="M8 3h8v5a4 4 0 0 1-8 0Zm0 2H4v2a4 4 0 0 0 5 4m7-6h4v2a4 4 0 0 1-5 4m-3 1v6m-4 3h8m-6-3h4v3" /></>,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /></>,
  signal: <><circle cx="12" cy="12" r="2" /><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16" /></>,
  cross: <><path d="M10 3h4v5h5v4h-5v9h-4v-9H5V8h5Z" /></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  filter: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="var(--surface)" /><circle cx="15" cy="12" r="2" fill="var(--surface)" /><circle cx="9" cy="18" r="2" fill="var(--surface)" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <><path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1" /></>,
  shield: <path d="m12 3 8 3v6c0 5-4 8-8 10-4-2-8-5-8-10V6Z" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  timeline: <><path d="M6 3v18m5-16h9m-9 7h6m-6 7h9" /><circle cx="6" cy="5" r="2" fill="var(--surface)" /><circle cx="6" cy="12" r="2" fill="var(--surface)" /><circle cx="6" cy="19" r="2" fill="var(--surface)" /></>,
  compare: <><path d="M4 7h16m-5-5 5 5-5 5M20 17H4m5-5-5 5 5 5" /></>,
  chat: <path d="M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0Z" />,
};

export function AppIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: AppIconName }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
