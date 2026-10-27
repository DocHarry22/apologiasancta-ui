"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { NativeHeader } from "@/components/native/NativeHeader";
import { AppIcon } from "@/components/native/AppIcon";
import { AuthPasswordField } from "./AuthPasswordField";
import auth from "./AuthExperience.module.css";
import study from "@/components/native/StudyUI.module.css";
import styles from "./AccountRecovery.module.css";
import { runWithStoredAccountSessionBoundary } from "@/lib/playerIdentity";

type Mode = "forgot" | "reset" | "verify";

export function AccountRecovery({ mode }: { mode: Mode }) {
  const id = useId();
  const capturedMode = useRef<Mode | null>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(mode === "forgot");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [retryIn, setRetryIn] = useState(0);

  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message, error]);

  useEffect(() => {
    if (mode === "forgot" || capturedMode.current === mode) return;
    capturedMode.current = mode;
    const candidate = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    if (/^[a-f0-9]{64}$/.test(candidate)) setToken(candidate);
    else if (mode === "reset" || candidate) {
      setMessage("This link is missing or invalid. Request a new link below.");
      setError(true);
    }
    setReady(true);
  }, [mode]);

  useEffect(() => {
    if (retryIn <= 0) return;
    const timer = window.setTimeout(() => setRetryIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryIn]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || retryIn > 0) return;
    setError(false);
    setMessage("");
    if (mode === "reset" && token && password !== confirmPassword) {
      setError(true);
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    const consuming = Boolean(token);
    const endpoint = consuming ? (mode === "reset" ? "reset-password" : "verify-email")
      : (mode === "verify" ? "verify-email/resend" : "forgot-password");
    try {
      const request = () => fetch(`/api/auth/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(consuming ? { token, newPassword: password, confirmPassword } : { email }),
      });
      const response = mode === "reset" && consuming
        ? await runWithStoredAccountSessionBoundary(request) : await request();
      const payload = await response.json().catch(() => null) as { ok?: boolean; code?: string; error?: string; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        if (response.status === 429) setRetryIn(Math.max(1, Number(response.headers.get("Retry-After")) || 60));
        if (payload?.code === "invalid_link") setToken("");
        setError(true);
        setMessage(payload?.error || "Unable to update your account. Please try again.");
        return;
      }
      if (consuming) {
        setComplete(true);
        setToken("");
        setPassword("");
        setConfirmPassword("");
        setMessage(mode === "reset"
          ? "Password reset. All signed-in sessions have ended. Sign in with your new password to continue."
          : "Email verified. You can now sign in and continue learning.");
      } else {
        setMessage(payload.message || "If this address is eligible, an email will arrive shortly. Check your inbox and spam folder.");
        setRetryIn(60);
      }
    } catch {
      setError(true);
      setMessage("Network error. Check your connection and try again.");
    } finally { setBusy(false); }
  };

  const linkRequested = Boolean(message) && !error && !complete;
  const missingResetLink = mode === "reset" && ready && !token && !complete;
  const intro = complete
    ? { title: mode === "reset" ? "A fresh start." : "Email confirmed.", accent: mode === "reset" ? "You’re ready." : "Keep growing.", description: mode === "reset" ? "Your new password is ready. Sign in to return to your learning." : "One more step in your journey, complete. Your next question is waiting." }
    : linkRequested
      ? { title: "Check your inbox.", accent: "One step closer.", description: "If this address is eligible, an email will arrive shortly. Check your inbox and spam folder." }
      : mode === "forgot"
        ? { title: "Forgot password?", accent: "Let’s begin again.", description: "It happens. Enter your account email to request a link and find your way back." }
        : missingResetLink
          ? { title: "A fresh link.", accent: "A new start.", description: "Request another reset link, then open the newest email to choose your password." }
          : mode === "reset"
            ? { title: "A fresh start.", accent: "Keep growing.", description: "Choose a unique password to protect your account and continue your journey." }
            : { title: "Verify your email.", accent: "Keep growing.", description: token ? "Confirm your email address, then return to learning with us." : "Enter your account email to request a verification link. Open the newest email to continue." };
  const title = complete ? (mode === "reset" ? "Password updated" : "Your email is verified")
    : linkRequested ? "Your next step"
      : mode === "forgot" ? "Send a reset link"
        : mode === "reset" ? (missingResetLink ? "Request a new reset link" : "Choose a new password")
          : token ? "Verify your email" : "Send a verification link";
  const submitLabel = busy ? "Please wait…" : retryIn > 0 ? `Try again in ${retryIn}s` : token ? (mode === "reset" ? "Reset password" : "Verify email address") : mode === "verify" ? "Resend verification email" : "Send reset link";
  const passwordHelpId = `${id}-password-help`;

  return (
    <div className={auth.page}>
      <NativeHeader />
      <main id="main-content" className={styles.layout}>
        <div className={auth.toolbar}><Link href="/login"><AppIcon name="arrow" width={15} height={15} /> Back to sign in</Link><a href="#recovery-help">Need help?</a></div>
        <header className={styles.intro}><p className={study.eyebrow}>{mode === "verify" ? "Email verification" : "Password recovery"}</p><h1 className={study.title}>{intro.title}<br /><em>{intro.accent}</em></h1><p className={study.introDescription}>{intro.description}</p></header>
        <section className={styles.card} aria-labelledby={`${id}-title`}>
          <div className={styles.cardHeader}><div className={styles.symbol} aria-hidden="true"><AppIcon name={complete || linkRequested ? "check" : mode === "reset" && token ? "lock" : "mail"} width={21} height={21} /></div><div><h2 id={`${id}-title`}>{title}</h2><p>{complete ? "Your account, ready for the next step." : mode === "reset" && token ? "A password that’s yours alone." : token ? "A moment to confirm it’s you." : "Use the email you registered with."}</p></div></div>
          <div className={styles.body}>
            {message ? <p ref={messageRef} tabIndex={-1} role={error ? "alert" : "status"} aria-live="polite" className={auth.notice} data-state={error ? "error" : "success"}>{message}</p> : null}
            {!ready ? <p role="status" className={styles.note}>Preparing your link…</p> : complete ? <>
              <Link href="/login" className={auth.primary}>{mode === "reset" ? "Sign in with your new password" : "Continue to sign in"}<AppIcon name="arrow" width={17} height={17} /></Link>
              {mode === "verify" ? <Link href="/account?section=security" className={styles.secondary}>Account security <AppIcon name="shield" width={15} height={15} /></Link> : null}
            </> : (
              <form onSubmit={submit} className={styles.form} aria-busy={busy}>
                {mode === "reset" && token ? <>
                  <AuthPasswordField id={`${id}-password`} label="New password" value={password} onChange={setPassword} autoComplete="new-password" visible={visible} onToggle={() => setVisible((value) => !value)} describedBy={passwordHelpId} disabled={busy} />
                  <p id={passwordHelpId} className={auth.passwordHelp}>Use 8–256 characters. A longer, unique passphrase is safer.</p>
                  <AuthPasswordField id={`${id}-confirm`} label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" visible={visible} onToggle={() => setVisible((value) => !value)} disabled={busy} />
                  <p className={styles.note}>Resetting your password signs you out on every device. Sign in again with your new password.</p>
                </> : !token ? <label className={auth.field} htmlFor={`${id}-email`}><span>Email address</span><input id={`${id}-email`} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} placeholder="you@example.com" className={auth.input} /></label> : <p className={styles.note}>You opened a verification link. Select the button below to confirm your email address.</p>}
                <button type="submit" disabled={busy || retryIn > 0} className={auth.primary}>{submitLabel}<AppIcon name={busy || retryIn > 0 ? "lock" : "arrow"} width={17} height={17} /></button>
              </form>
            )}
            {!complete && ready ? <p className={styles.linkNote}><AppIcon name="shield" width={14} height={14} /><span>{mode === "verify" ? "Verification links are single-use and expire after 24 hours." : "Reset links are single-use and expire after 30 minutes."}</span></p> : null}
          </div>
        </section>
        <aside id="recovery-help" className={styles.help} aria-labelledby={`${id}-help`}>
          <h2 id={`${id}-help`}>{complete ? "A little further, every day." : token ? "Need a fresh link?" : "Can’t find the email?"}</h2>
          <p>{complete ? "Your account is ready for you to return to your learning. Take the next step at your own pace." : token ? "If this link has expired or you opened an older email, request another link and use the newest one." : "Check your spam folder and make sure you entered your account email. If you request another link, use the newest email."}</p>
          {!complete && mode === "reset" && token ? <Link href="/forgot-password">Request a new reset link <AppIcon name="arrow" width={14} height={14} /></Link> : null}
          {!complete && mode === "verify" && token ? <button type="button" disabled={busy} onClick={() => { setToken(""); setMessage(""); setError(false); }}>Request a new verification link <AppIcon name="arrow" width={14} height={14} /></button> : null}
        </aside>
      </main>
    </div>
  );
}

export function EmailVerificationPanel({ verifiedAt }: { verifiedAt?: string | null }) {
  return <div className="surface-card p-5">
    <h3 className="editorial-heading text-xl font-semibold">Email verification</h3>
    <p className="mt-2 text-sm leading-6 text-(--text-muted)">{verifiedAt ? "Your email address is verified." : "Your email address has not been verified. Verify it to help protect your account and keep recovery available."}</p>
    {!verifiedAt ? <Link href="/verify-email" className="btn-secondary mt-4 inline-flex">Verify email</Link> : null}
  </div>;
}
