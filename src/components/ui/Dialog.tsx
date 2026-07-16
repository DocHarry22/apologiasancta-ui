"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function Dialog({ titleId, descriptionId, onClose, className = "", children }: { titleId: string; descriptionId?: string; onClose?: () => void; className?: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
    (first ?? panelRef.current)?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4 backdrop-blur-sm" role="presentation"><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className={`w-full border border-(--card-border) bg-(--surface-elevated) shadow-2xl ${className}`} onKeyDown={(event) => {
    if (event.key === "Escape" && onClose) { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])];
    if (!focusable.length) { event.preventDefault(); panelRef.current?.focus(); return; }
    const first = focusable[0]; const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}>{children}</div></div>;
}
