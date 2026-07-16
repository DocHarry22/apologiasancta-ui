import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "Privacy overview",
  description: "How Apologia Sancta currently handles account, learning, library, and live-quiz data.",
};

const sections = [
  ["Data kept on this device", "Theme preference, a resilient copy of lesson completion and practice totals, Library bookmarks, and the lightweight live-quiz identity are stored in this browser. The learning copy remains usable offline; bookmarks and live-quiz identity are not account-synced."],
  ["Authenticated account data", "When account services and cloud learning sync are configured, the server stores profile and security records plus merged lesson completions, practice best score, practice attempt count, revision metadata, and deduplication IDs. Server credentials and database errors are not exposed to the browser."],
  ["Live quiz data", "A room may process your public display name, submitted answer, timing result, score, and streak. Display names and scores can appear to other room participants and in returned leaderboards, so do not use contact details as a quiz name."],
  ["Research Graph", "Apologia Graph is a separate public application with its own deployment and storage behaviour. Opening it leaves Apologia Sancta; this site does not copy Graph workspace data into your account."],
] as const;

export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="page-container py-8 sm:py-12">
        <header className="max-w-3xl">
          <p className="eyebrow">Public information</p>
          <h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">Privacy overview</h1>
          <p className="mt-4 text-base leading-7 text-(--text-muted)">This describes the product&apos;s current technical behaviour. A jurisdiction-specific legal privacy policy, retention schedule, and accountable contact must be approved before public commercial launch.</p>
        </header>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {sections.map(([title, description]) => <section key={title} className="surface-card p-5 sm:p-6"><h2 className="editorial-heading text-2xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-(--text-muted)">{description}</p></section>)}
        </div>
        <section className="surface-card mt-6 p-5 sm:p-6" aria-labelledby="privacy-controls-heading">
          <h2 id="privacy-controls-heading" className="editorial-heading text-2xl font-semibold">Controls available now</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-(--text-muted)">Signed-in users can clear the learning copy and saved quiz identity on this browser from Account. Account-wide learning deletion, account deletion, and verified data export are not shown because those server workflows are not complete.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link href="/account?section=privacy" className="btn-primary">Open account privacy controls</Link><Link href="/library" className="btn-secondary">Manage Library bookmarks</Link></div>
        </section>
      </div>
    </AppShell>
  );
}
