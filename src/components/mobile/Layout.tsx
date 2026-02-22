"use client";

import { ReactNode } from "react";

interface LayoutProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
}

export function Layout({ leftContent, rightContent }: LayoutProps) {
  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      {/* Left column - exactly 80% */}
      <div className="w-4/5 flex flex-col min-w-0 overflow-hidden">
        {leftContent}
      </div>
      
      {/* Right column - exactly 20% (leaderboard) - starts at top */}
      <div className="w-1/5 min-w-0 shrink-0 bg-(--leaderboard-bg) border-l border-(--border) overflow-y-auto">
        {rightContent}
      </div>
    </div>
  );
}
