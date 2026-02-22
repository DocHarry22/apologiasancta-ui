"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshTopicsButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      className="shrink-0 rounded-lg border border-(--border) px-3 py-1.5 text-xs font-medium text-(--muted) hover:border-(--accent) hover:text-(--accent) transition-colors disabled:opacity-60"
      title="Refresh topics from latest synced content"
    >
      {refreshing ? "Refreshing..." : "Refresh"}
    </button>
  );
}
