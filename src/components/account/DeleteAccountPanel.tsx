"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScreenSurface, ScreenIntro } from "@/components/native/ScreenSurface";
import styles from "@/components/native/ScreenSurface.module.css";
import study from "@/components/native/StudyUI.module.css";
import { fetchAccountAccessJson } from "@/lib/accountAccessRequest";
import { RequestTimeoutError } from "@/lib/fetchWithTimeout";

export function DeleteAccountPanel({ signedIn, accountType }: { signedIn: boolean; accountType: "public" | "staff" | null }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const deleteAccount = async () => {
    if (confirmation !== "DELETE" || status === "deleting") return;
    setStatus("deleting");
    setMessage("");
    let deletionStarted = false;

    try {
      const csrfResult = await fetchAccountAccessJson<{ csrfToken?: string }>("/api/auth/csrf", { cache: "no-store", credentials: "include" });
      const csrfResponse = csrfResult.response;
      if (!csrfResponse.ok) {
        setStatus("error");
        setMessage("Your session has expired. Sign in again before deleting the account.");
        return;
      }
      const csrfPayload = csrfResult.data ?? null;
      if (!csrfPayload?.csrfToken) throw new Error("Missing CSRF token");

      deletionStarted = true;
      const result = await fetchAccountAccessJson<{ error?: string }>("/api/auth/me", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfPayload.csrfToken,
        },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const { response } = result;
      const payload = result.data ?? null;
      if (!response.ok) {
        setStatus("error");
        setMessage(payload?.error || "Account deletion is temporarily unavailable. Please retry.");
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
      window.setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 1200);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof RequestTimeoutError
        ? deletionStarted
          ? "The deletion request timed out and may already have completed. Check whether you can still sign in before trying again."
          : "The security check took too long. No deletion request was sent; check your connection and try again."
        : "Account deletion is temporarily unavailable. Please retry.");
    }
  };

  if (!signedIn) {
    return (
      <ScreenSurface><ScreenIntro eyebrow="Account controls" title="Delete your Apologia Sancta account" description="Review what account deletion removes before you choose to continue." /><section className={styles.card}>
        <p className="mt-4 text-sm leading-6 text-(--text-muted)">
          Sign in to verify ownership, then you can permanently delete your account and account-linked learning data from this page.
        </p>
        <Link className="btn-primary mt-6 inline-flex" href="/login?next=%2Faccount%2Fdelete">Sign in to continue</Link>
      </section></ScreenSurface>
    );
  }

  if (accountType !== "public") {
    return (
      <ScreenSurface><ScreenIntro eyebrow="Account controls" title="Staff account" /><section className={styles.card}>
        <p className="mt-4 text-sm leading-6 text-(--text-muted)">Staff accounts are governed administratively and cannot be deleted through the learner self-service flow.</p>
        <Link className="btn-secondary mt-6 inline-flex" href="/account">Back to account</Link>
      </section></ScreenSurface>
    );
  }

  return (
    <ScreenSurface><header className={study.intro}><p className={study.eyebrow} style={{ color: "var(--danger)" }}>Permanent action</p><h1 className={study.title}>Delete your account</h1></header><section className={styles.card}>
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
        autoCapitalize="characters"
        spellCheck={false}
      />

      {message ? (
        <p className={`mt-4 rounded-lg border px-3 py-2.5 text-sm ${status === "success" ? "border-(--success) text-(--success)" : "border-(--danger) text-(--danger)"}`} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.danger}
          disabled={confirmation !== "DELETE" || status === "deleting" || status === "success"}
          onClick={deleteAccount}
        >
          {status === "deleting" ? "Deleting…" : "Permanently delete account"}
        </button>
        <Link className="btn-secondary" href="/account?section=privacy">Cancel</Link>
      </div>
    </section></ScreenSurface>
  );
}
