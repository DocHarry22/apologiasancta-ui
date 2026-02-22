"use client";

import { useEffect, useState } from "react";
import type { TopicWithCount } from "@/lib/content";
import AuthorDashboardClient from "./AuthorDashboardClient";

interface Props {
  topics: TopicWithCount[];
}

export default function AuthorDashboardMounted({ topics }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="p-4 lg:p-6">
        <div className="mx-auto max-w-7xl">Loading dashboard…</div>
      </div>
    );
  }

  return <AuthorDashboardClient topics={topics} />;
}
