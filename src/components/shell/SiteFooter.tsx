import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-(--border) bg-(--surface)">
      <div className="page-container flex flex-col gap-4 py-7 text-sm text-(--text-muted) sm:flex-row sm:items-center sm:justify-between">
        <p>Apologia Sancta — Defend the Faith. Learn the Truth.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer navigation">
          <Link href="/research" className="hover:text-(--gold-hover)">Sources</Link>
          <Link href="/privacy" className="hover:text-(--gold-hover)">Privacy</Link>
          <Link href="/admin/login" className="hover:text-(--gold-hover)">Staff</Link>
        </nav>
      </div>
    </footer>
  );
}
