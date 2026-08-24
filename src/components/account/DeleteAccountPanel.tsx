"use client";

import Link from "next/link";
import { useState } from "react";

export function DeleteAccountPanel({ signedIn, accountType }: { signedIn: boolean; accountType: "public" | "staff" | null }) {
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const deleteAccount = async () => {
    if (confirmation !== "DELETE" || status === "deleting") return;
    setStatus("deleting");
    setMessage("");

    try {
      const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store", credentials: "include" });
      if (!csrfResponse.ok) {
        setStatus("error");
        setMessage("Your session has expired. Sign in again before deleting the account.");
        return;
      }
      const csrfPayload = await csrfResponse.json() as { csrfToken?: string };
      if (!csrfPayload.csrfToken) throw new Error("Missing CSRF token");

      const response = await fetch("/api/auth/me", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfPayload.csrfToken,
        },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error || "Account deletion is temporarily unavailable. Please retry.");
        return;
      }

      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // Server-side deletion has already completed; browser storage is best effort.
      }
      setStatus("success");
      setMessage("Your Apologia Sancta account and account-linked learning data were deleted.");
      window.setTimeout(() => window.location.assign("/"), 1200);
    } catch {
      setStatus("error");
      setMessage("Account deletion is temporarily unavailable. Please retry.");
    }
  };

  if (!signedIn) {
    return (
      <section className="surface-card-elevated mx-auto max-w-2xl p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-(--gold-hover)">Account deletion</p>
        <h1 className="mt-2 editorial-heading text-3xl">Delete your Apologia Sancta account</h1>
        <p className="mt-4 text-sm leading-6 text-(--text-muted)">
          Sign in to verify ownership, then you can permanently delete your account and account-linked learning data from this page.
        </p>
        <Link className="btn-primary mt-6 inline-flex" href="/login?next=%2Faccount%2Fdelete">Sign in to continue</Link>
      </section>
    );
  }

  if (accountType !== "public") {
    return (
      <section className="surface-card-elevated mx-auto max-w-2xl p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-(--gold-hover)">Account deletion</p>
        <h1 className="mt-2 editorial-heading text-3xl">Staff account</h1>
        <p className="mt-4 text-sm leading-6 text-(--text-muted)">Staff accounts are governed administratively and cannot be deleted through the learner self-service flow.</p>
        <Link className="btn-secondary mt-6 inline-flex" href="/account">Back to account</Link>
      </section>
    );
  }

  return (
    <section className="surface-card-elevated mx-auto max-w-2xl p-6 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-(--danger)">Permanent action</p>
      <h1 className="mt-2 editorial-heading text-3xl">Delete your account</h1>
      <p className="mt-4 text-sm leading-6 text-(--text-muted)">
        This permanently removes your Apologia Sancta learner account, profile details, lesson progress, bookmarks, mastery attempts, answers, unlocks, review schedule, and derived mastery records. Live-quiz history is anonymised so aggregate competition results can remain intact without your account link or display name.
      </p>
      <p className="mt-3 text-sm font-semibold text-(--text)">This cannot be undone.</p>

      <label className="mt-6 block text-sm font-bold" htmlFor="delete-account-confirmation">
        Type DELETE to confirm
      </label>
      <input
        id="delete-account-confirmation"
        className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-3 text-(--text) outline-none focus:border-(--danger)"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />

      {message ? (
        <p className={`mt-4 rounded-lg border px-3 py-2.5 text-sm ${status === "success" ? "border-(--success) text-(--success)" : "border-(--danger) text-(--danger)"}`} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg border border-(--danger) px-4 py-2.5 text-sm font-black text-(--danger) disabled:cursor-not-allowed disabled:opacity-50"
          disabled={confirmation !== "DELETE" || status === "deleting" || status === "success"}
          onClick={deleteAccount}
        >
          {status === "deleting" ? "Deleting…" : "Permanently delete account"}
        </button>
        <Link className="btn-secondary" href="/account?section=privacy">Cancel</Link>
      </div>
    </section>
  );
}
