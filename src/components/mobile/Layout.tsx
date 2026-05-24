"use client";

import { ReactNode } from "react";

interface LayoutProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
}

export function Layout({ leftContent, rightContent }: LayoutProps) {
  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        {leftContent}
      </div>

      <aside className="hidden min-w-0 shrink-0 border-l border-(--border) bg-(--leaderboard-bg) lg:block lg:h-screen lg:w-[340px] lg:overflow-y-auto 2xl:w-[380px]">
        {rightContent}
      </aside>
    </div>
  );
}
