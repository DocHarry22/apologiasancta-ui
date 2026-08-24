import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy information for Apologia Sancta.",
};

export default function PrivacyPolicyPage() {
  return (
    <AppShell>
      <main className="page-container py-10 sm:py-14" id="main-content">
        <article className="surface-card-elevated mx-auto max-w-3xl p-6 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-(--gold-hover)">Privacy</p>
          <h1 className="mt-2 editorial-heading text-4xl">Apologia Sancta Privacy Policy</h1>
          <p className="mt-2 text-sm text-(--text-muted)">Effective 24 August 2026</p>

          <div className="mt-8 space-y-7 text-sm leading-7 text-(--text-muted)">
            <section>
              <h2 className="text-lg font-black text-(--text)">Information used by the service</h2>
              <p className="mt-2">When you create or use an account, Apologia Sancta processes account information such as your email address, display name, optional phone number, account role, account timestamps, and authentication/security state. The learning service can also store lesson progress, bookmarks, assessment attempts and answers, unlocks, review schedules, and derived mastery records linked to your learner profile.</p>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">Device data</h2>
              <p className="mt-2">Some interface preferences, saved learning state, bookmarks, and live-quiz convenience data can be stored locally on your device or browser. Clearing app/browser storage removes that local copy but does not by itself delete an authenticated account.</p>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">How the information is used</h2>
              <p className="mt-2">Account and learning information is used to authenticate users, operate account security, preserve learning progress, score governed assessments, unlock learning content, support saved resources, and operate quiz and competition features.</p>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">Account deletion</h2>
              <p className="mt-2">Learner accounts can be permanently deleted from the app or from the web account-deletion page. Deletion removes the authenticated learner account and account-linked learning records. Historical live-quiz participation may be retained only in anonymised form so aggregate competition results remain consistent; the learner account link, display name, participant key, and participant metadata are removed from those retained records.</p>
              <Link className="btn-secondary mt-4 inline-flex" href="/account/delete">Delete an account</Link>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">Security</h2>
              <p className="mt-2">The production Android app requires HTTPS for its configured web service, uses authenticated sessions and CSRF protection for account mutations, and does not request Android permissions beyond network access in its application manifest.</p>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">Policy changes</h2>
              <p className="mt-2">This policy may be updated when the app, its data handling, or store requirements change. The effective date above identifies the version currently published with the application.</p>
            </section>
          </div>
        </article>
      </main>
    </AppShell>
  );
}
