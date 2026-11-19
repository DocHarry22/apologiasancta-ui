"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ResearchRetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn-secondary mt-4"
      disabled={refreshing}
      aria-busy={refreshing}
      onClick={() => startTransition(() => router.refresh())}
    >
      {refreshing ? "Refreshing…" : label}
    </button>
  );
}
