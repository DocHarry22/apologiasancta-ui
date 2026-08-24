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
          <h1 className="mt-2 editorial-heading text-4xl">Privacy overview</h1>
          <p className="mt-2 text-sm font-semibold text-(--text)">Apologia Sancta Privacy Policy</p>
          <p className="mt-2 text-sm text-(--text-muted)">Effective 24 August 2026</p>

          <div className="mt-8 space-y-7 text-sm leading-7 text-(--text-muted)">
            <section>
              <h2 className="text-lg font-black text-(--text)">Information used by the service</h2>
              <p className="mt-2">When you create or use an account, Apologia Sancta processes account information such as your email address, display name, optional phone number, account role, account timestamps, and authentication/security state. The learning service can also store lesson progress, bookmarks, assessment attempts and answers, unlocks, review schedules, derived mastery records, and research journeys you deliberately save to your learner profile.</p>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">Saved research journeys and sharing</h2>
              <p className="mt-2">A saved research journey contains canonical Knowledge Engine identifiers, a title, lens, visibility choice, navigation metadata, and timestamps. It does not copy the underlying theological claims or source texts into the journey record. Private journeys are account-only. If you choose an unlisted share link, anyone who obtains that opaque link can view the saved sequence of canonical identifiers until the journey is deleted or made private.</p>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">Device data</h2>
              <p className="mt-2">Some interface preferences, saved learning state, bookmarks, and live-quiz convenience data can be stored locally on your device or browser. Clearing app/browser storage removes that local copy but does not by itself delete an authenticated account or research journeys deliberately saved to the account.</p>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">How the information is used</h2>
              <p className="mt-2">Account and learning information is used to authenticate users, operate account security, preserve learning progress, score governed assessments, derive evidence-based concept mastery, unlock learning content, support saved resources and research journeys, and operate quiz and competition features.</p>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">Account deletion</h2>
              <p className="mt-2">Learner accounts can be permanently deleted from the app or from the web account-deletion page. Deletion removes the authenticated learner account and account-linked learning records, including learner-owned saved research journeys through the learner-profile deletion cascade. Historical live-quiz participation may be retained only in anonymised form so aggregate competition results remain consistent; the learner account link, display name, participant key, and participant metadata are removed from those retained records.</p>
              <Link className="btn-secondary mt-4 inline-flex" href="/account/delete">Delete an account</Link>
            </section>

            <section>
              <h2 className="text-lg font-black text-(--text)">Security</h2>
              <p className="mt-2">The production Android app requires HTTPS for its configured web service, uses authenticated sessions and CSRF protection for account mutations, and does not request Android permissions beyond network access in its application manifest. Learner-owned journey rows are additionally protected by database row-level security; anonymous clients have no direct table access.</p>
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
