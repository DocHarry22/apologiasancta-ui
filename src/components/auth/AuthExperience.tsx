"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { NativeHeader } from "@/components/native/NativeHeader";
import { AppIcon } from "@/components/native/AppIcon";
import study from "@/components/native/StudyUI.module.css";
import styles from "./AuthExperience.module.css";
import { AuthPasswordField as PasswordField } from "./AuthPasswordField";
import { runWithStoredAccountSessionBoundary } from "@/lib/playerIdentity";

type AuthMode = "signin" | "signup";
type FormState = "idle" | "loading" | "error" | "success";
type AccountKind = "learner" | "staff";

export interface AuthExperienceProps {
  initialMode: AuthMode;
  defaultNextPath: string;
  allowedNextPrefixes: string[];
}

interface AuthPayload {
  verificationRequired?: boolean;
  redirectTo?: string;
  error?: string;
  code?: string;
  reason?: string;
  diagnosticId?: string;
}

const reasonMessages: Record<string, string> = {
  session_secret_missing: "Secure sessions are not available on this deployment.",
  database_configuration_missing: "The account database has not been configured.",
  database_url_invalid: "The account database address is not supported.",
  database_access_denied: "The account database rejected the configured credentials.",
  database_permission_denied: "The account database needs additional table permissions.",
  database_not_found: "The configured account database could not be found.",
  database_host_not_found: "The account database host could not be reached.",
  database_connection_refused: "The account database refused the connection.",
  database_connection_timeout: "The account database connection timed out.",
  database_tls_failed: "A secure account database connection could not be established.",
  database_schema_incompatible: "The account database schema could not be prepared.",
  database_initialization_failed: "The account database could not be initialized.",
};

function unavailableMessage(payload: AuthPayload | null, mode: AuthMode): string {
  const detail = payload?.reason ? reasonMessages[payload.reason] : undefined;
  const fallback = mode === "signup"
    ? "Account creation is temporarily unavailable."
    : "Sign-in is temporarily unavailable.";
  const reference = payload?.diagnosticId
    ? ` Diagnostic reference: ${payload.diagnosticId}.`
    : "";

  return `${detail || fallback}${reference}`;
}

function safeRequestedPath(candidate: string | null, allowedPrefixes: string[]): string | null {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;

  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return null;

    const allowed = allowedPrefixes.some((rawPrefix) => {
      const prefix = rawPrefix.length > 1 ? rawPrefix.replace(/\/$/, "") : rawPrefix;
      return prefix === "/" || url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
    });

    return allowed ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function AuthExperience({
  initialMode,
  defaultNextPath,
  allowedNextPrefixes,
}: AuthExperienceProps) {
  const router = useRouter();
  const idPrefix = useId();
  const signInTabRef = useRef<HTMLButtonElement>(null);
  const signUpTabRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [formState, setFormState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [accountKind, setAccountKind] = useState<AccountKind>("learner");

  useEffect(() => {
    if (formState === "error" && message) messageRef.current?.focus();
  }, [formState, message]);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "session_expired") {
      setSessionMessage("Your session expired or was revoked. Sign in again to continue.");
    }
  }, []);

  const selectMode = (nextMode: AuthMode, focus = false) => {
    setMode(nextMode);
    setFormState("idle");
    setMessage("");
    if (focus) {
      window.setTimeout(() => {
        (nextMode === "signin" ? signInTabRef : signUpTabRef).current?.focus();
      }, 0);
    }
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      selectMode(mode === "signin" ? "signup" : "signin", true);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectMode("signin", true);
    } else if (event.key === "End") {
      event.preventDefault();
      selectMode("signup", true);
    }
  };

  const destinationAfterAuth = (payload: AuthPayload | null) => {
    const requested = safeRequestedPath(
      new URLSearchParams(window.location.search).get("next"),
      allowedNextPrefixes
    );
    const responseDestination = safeRequestedPath(payload?.redirectTo ?? null, allowedNextPrefixes);
    const fallback = safeRequestedPath(defaultNextPath, ["/"]) || "/";
    return requested || responseDestination || fallback;
  };

  const navigateAfterAuth = (destination: string) => {
    const pathname = new URL(destination, window.location.origin).pathname;
    if (/^\/(?:admin|author)(?:\/|$)/.test(pathname)) {
      // These destinations have session-sensitive server layouts. A full
      // same-origin navigation guarantees the new HTTP-only cookie is applied
      // when that layout is rendered, without competing RSC refresh requests.
      window.location.assign(destination);
      return;
    }
    router.push(destination);
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormState("loading");
    setMessage("");

    try {
      const response = await runWithStoredAccountSessionBoundary(() => fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }));

      const payload = (await response.json().catch(() => null)) as AuthPayload | null;
      if (response.ok) {
        setFormState("success");
        navigateAfterAuth(destinationAfterAuth(payload));
        return;
      }

      setFormState("error");
      if (response.status === 401) {
        setMessage("Incorrect email or password. Check your details and try again.");
      } else if (response.status === 429) {
        setMessage("Too many sign-in attempts. Wait a moment before trying again.");
      } else if (response.status === 503) {
        setMessage(unavailableMessage(payload, "signin"));
      } else if (payload?.code === "email_verification_required") {
        router.push("/verify-email");
      } else {
        setMessage(payload?.error || "Unable to sign in right now. Please try again.");
      }
    } catch {
      setFormState("error");
      setMessage("Network error. Check your connection and try again.");
    }
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormState("loading");
    setMessage("");

    if (password !== confirmPassword) {
      setFormState("error");
      setMessage("Passwords do not match.");
      return;
    }

    try {
      const response = await runWithStoredAccountSessionBoundary(() => fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
          phone,
          inviteCode: accountKind === "staff" ? inviteCode : "",
        }),
      }));

      const payload = (await response.json().catch(() => null)) as AuthPayload | null;
      if (response.ok) {
        setFormState("success");
        if (payload?.verificationRequired) router.push("/verify-email");
        else navigateAfterAuth(destinationAfterAuth(payload));
        return;
      }

      setFormState("error");
      if (response.status === 429) {
        setMessage("Too many account creation attempts. Wait a moment before trying again.");
      } else if (response.status === 503) {
        setMessage(unavailableMessage(payload, "signup"));
      } else {
        setMessage(payload?.error || "Unable to create your account right now. Please try again.");
      }
    } catch {
      setFormState("error");
      setMessage("Network error. Check your connection and try again.");
    }
  };

  const clearSession = async () => {
    setFormState("loading");
    setMessage("");
    try {
      await runWithStoredAccountSessionBoundary(() => fetch("/api/auth/logout", { method: "POST" }));
      setFormState("success");
      setMessage("Saved session cleared. You can sign in with another account.");
      router.refresh();
    } catch {
      setFormState("error");
      setMessage("The saved session could not be cleared. Check your connection and try again.");
    }
  };

  const signInPanelId = `${idPrefix}-signin-panel`;
  const signUpPanelId = `${idPrefix}-signup-panel`;
  const passwordHelpId = `${idPrefix}-password-help`;
  const isLoading = formState === "loading";

  return (
    <div className={styles.page}>
      <NativeHeader />
      <main id="main-content" className={styles.layout}>
        <div className={styles.toolbar}><Link href="/mobile"><AppIcon name="arrow" width={15} height={15} /> Back to live quiz</Link><a href="#auth-help">Need help?</a></div>
        <section className={styles.intro} aria-labelledby="auth-introduction">
          <p className={study.eyebrow}>{mode === "signin" ? "Your journey continues" : "A little curiosity. A deeper faith."}</p>
          <h1 id="auth-introduction" className={study.title}>{mode === "signin" ? <>Welcome back.<br /><em>Keep growing.</em></> : <>Begin here.<br /><em>Grow in faith.</em></>}</h1>
          <p className={study.introDescription}>{mode === "signin" ? "Return to your learning, explore a question, and take the next step in faith." : "Make room for learning, thoughtful questions, and a faith that keeps growing."}</p>
          <div className={styles.story}>
            <AppIcon name="cross" width={29} height={29} />
            <h2>Rooted in truth.<br /><em>Growing together.</em></h2>
            <p>Explore the Catholic faith with curiosity, understanding, and charity.</p>
            <ul><li><AppIcon name="book" width={20} height={20} /><span>Lessons grounded in Scripture and Tradition</span></li><li><AppIcon name="spark" width={20} height={20} /><span>Questions that invite you to think more deeply</span></li><li><AppIcon name="play" width={20} height={20} /><span>Live quizzes to learn with others</span></li></ul>
          </div>
        </section>

        <section className={styles.access} aria-label="Account access">
          <div className={styles.card}>
            <div className={styles.tabs} role="tablist" aria-label="Choose account action">
              <button
                ref={signInTabRef}
                id={`${idPrefix}-signin-tab`}
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                aria-controls={signInPanelId}
                tabIndex={mode === "signin" ? 0 : -1}
                onClick={() => selectMode("signin")}
                onKeyDown={handleTabKeyDown}
                className={styles.tab}
                disabled={isLoading}
              >
                <AppIcon name="lock" width={15} height={15} /> Sign in
              </button>
              <button
                ref={signUpTabRef}
                id={`${idPrefix}-signup-tab`}
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                aria-controls={signUpPanelId}
                tabIndex={mode === "signup" ? 0 : -1}
                onClick={() => selectMode("signup")}
                onKeyDown={handleTabKeyDown}
                className={styles.tab}
                disabled={isLoading}
              >
                <AppIcon name="account" width={15} height={15} /> Create account
              </button>
            </div>
          <div className={styles.body}>
            {sessionMessage && !message ? (
              <p className={styles.notice} role="status">
                {sessionMessage}
              </p>
            ) : null}

            {message ? <p ref={messageRef} tabIndex={-1} role={formState === "error" ? "alert" : "status"} aria-live="polite" className={styles.notice} data-state={formState}>{message}</p> : null}

            {mode === "signin" ? (
              <div id={signInPanelId} role="tabpanel" aria-labelledby={`${idPrefix}-signin-tab`}>
                <h2 className={styles.panelTitle}>Sign in to your account</h2>
                <form onSubmit={handleSignIn} className={styles.form} aria-busy={isLoading}>
                  <label className={styles.field} htmlFor={`${idPrefix}-signin-email`}>
                    <span>Email address</span>
                    <input
                      id={`${idPrefix}-signin-email`}
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      maxLength={254}
                      required
                      placeholder="you@example.com"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={styles.input}
                    />
                  </label>
                  <PasswordField
                    id={`${idPrefix}-signin-password`}
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    visible={passwordVisible}
                    onToggle={() => setPasswordVisible((current) => !current)}
                  />
                  <button type="submit" disabled={isLoading || !email.trim() || !password} className={styles.primary}>
                    {isLoading ? "Signing in…" : "Sign in securely"} <AppIcon name="arrow" width={17} height={17} />
                  </button>
                  <div className={styles.recovery}><Link href="/forgot-password">Forgot password?</Link><Link href="/verify-email">Verify email</Link></div>
                </form>
              </div>
            ) : (
              <div id={signUpPanelId} role="tabpanel" aria-labelledby={`${idPrefix}-signup-tab`}>
                <h2 className={styles.panelTitle}>Create your account</h2>
                <form onSubmit={handleSignUp} className={styles.form} aria-busy={isLoading}>
                  <fieldset>
                    <legend>Account type</legend>
                    <div className={styles.accountKinds}>
                      {([
                        ["learner", "Learner", "Lessons and quizzes"],
                        ["staff", "Staff", "Invite code required"],
                      ] as const).map(([value, label, detail]) => (
                        <label key={value} className={styles.accountKind}>
                            <input
                              type="radio"
                              name={`${idPrefix}-account-kind`}
                              value={value}
                              checked={accountKind === value}
                              onChange={() => setAccountKind(value)}
                            />
                            <span>
                              <strong>{label}</strong>
                              <small>{detail}</small>
                            </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className={styles.field} htmlFor={`${idPrefix}-name`}>
                    <span>Display name</span>
                    <input id={`${idPrefix}-name`} type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={120} required placeholder="How shall we know you?" className={styles.input} />
                  </label>
                  <label className={styles.field} htmlFor={`${idPrefix}-signup-email`}>
                    <span>Email address</span>
                    <input id={`${idPrefix}-signup-email`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required placeholder="you@example.com" className={styles.input} />
                  </label>
                  <PasswordField
                    id={`${idPrefix}-signup-password`}
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    visible={passwordVisible}
                    onToggle={() => setPasswordVisible((current) => !current)}
                    describedBy={passwordHelpId}
                  />
                  <p id={passwordHelpId} className={styles.passwordHelp}>Use at least 8 characters. A longer, unique passphrase is safer.</p>
                  <PasswordField
                    id={`${idPrefix}-confirm-password`}
                    label="Confirm password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                    visible={passwordVisible}
                    onToggle={() => setPasswordVisible((current) => !current)}
                  />
                  <details className={styles.optional}><summary>Optional details</summary><label className={styles.field} htmlFor={`${idPrefix}-phone`}><span>Phone <span>(optional)</span></span><input id={`${idPrefix}-phone`} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" maxLength={32} className={styles.input} /></label></details>
                  {accountKind === "staff" ? (
                    <label className={styles.field} htmlFor={`${idPrefix}-invite`}>
                      <span>Staff invite code</span>
                      <input id={`${idPrefix}-invite`} type="text" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={128} required className={styles.input} />
                    </label>
                  ) : null}
                  <button
                    type="submit"
                    disabled={isLoading || !name.trim() || !email.trim() || password.length < 8 || !confirmPassword || (accountKind === "staff" && !inviteCode.trim())}
                    className={styles.primary}
                  >
                    {isLoading ? "Creating account…" : "Create account"} <AppIcon name="arrow" width={17} height={17} />
                  </button>
                </form>
              </div>
            )}

            <p className={styles.reassurance}><AppIcon name="shield" width={13} height={13} /> {mode === "signin" ? "Your next step starts here." : "Learner accounts need no invitation code."}</p>
          </div>
          </div>
          <aside id="auth-help" className={styles.help} aria-labelledby="auth-help-title">
            <h2 id="auth-help-title">A little help, if you need it.</h2>
            <p>{mode === "signup" ? "Choose Learner for lessons and quizzes. If you’ve been invited to a staff workspace, choose Staff and enter your invitation code." : "Use the same email you registered with. If you’re switching accounts or having trouble with an old sign-in, clear the saved session and try again."}</p>
            <button type="button" onClick={clearSession} disabled={isLoading}><AppIcon name="lock" width={14} height={14} /> Clear saved session</button>
          </aside>
        </section>
      </main>
    </div>
  );
}
