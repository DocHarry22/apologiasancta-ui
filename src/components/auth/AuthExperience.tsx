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
import { BrandMark } from "@/components/shell/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggle,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  visible: boolean;
  onToggle: () => void;
  describedBy?: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="flex items-center justify-between gap-3">
        <label className="text-sm font-bold text-(--text)" htmlFor={id}>{label}</label>
        <button
          type="button"
          className="rounded text-xs font-semibold text-(--gold-hover) hover:underline"
          onClick={onToggle}
          aria-controls={id}
          aria-pressed={visible}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        >
          <span aria-hidden="true">{visible ? "Hide" : "Show"}</span>
        </button>
      </span>
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        minLength={autoComplete === "new-password" ? 8 : undefined}
        maxLength={256}
        required
        className="form-control"
      />
    </div>
  );
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
        navigateAfterAuth(destinationAfterAuth(payload));
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
    <main id="main-content" className="min-h-screen bg-(--background) text-(--text)">
      <header className="border-b border-(--border) bg-(--nav-bg)">
        <div className="page-container flex min-h-[4.5rem] items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden sm:inline-flex"><Link href="/mobile" className="btn-quiet">Back to live quiz</Link></span>
            <a href="#auth-help" className="rounded-md text-sm font-bold text-(--gold-hover) hover:underline">Need help?</a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="page-container grid gap-8 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)] lg:items-start lg:gap-14 lg:py-16">
        <section className="order-2 max-w-2xl pt-2 lg:order-1 lg:sticky lg:top-8 lg:pt-8" aria-labelledby="auth-introduction">
          <p className="eyebrow">Formation begins with a firm foundation</p>
          <h1 id="auth-introduction" className="editorial-heading mt-4 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
            Know the Faith.<br />Answer with charity.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-(--text-muted) sm:text-lg">
            One account keeps your learning path and staff permissions secure. Your current learning and live-quiz history remain on this device until cloud progress sync is available.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Sourced lessons", "Catechism, Scripture, councils"],
              ["02", "Practice", "Explanations after every answer"],
              ["03", "Compete", "Live rooms and leaderboards"],
            ].map(([number, title, detail]) => (
              <div key={number} className="surface-card p-4">
                <span className="text-xs font-black tracking-[0.18em] text-(--gold)">{number}</span>
                <h2 className="editorial-heading mt-2 text-lg font-semibold">{title}</h2>
                <p className="mt-1 text-xs leading-5 text-(--text-muted)">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card-elevated order-1 overflow-hidden lg:order-2" aria-label="Account access">
          <div className="border-b border-(--border) px-5 pt-5 sm:px-7 sm:pt-7">
            <p className="eyebrow">Apologia Sancta account</p>
            <div className="mt-4 grid grid-cols-2" role="tablist" aria-label="Choose account action">
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
                className={`border-b-2 px-3 py-3 text-sm font-extrabold ${mode === "signin" ? "border-(--gold) text-(--text)" : "border-transparent text-(--text-muted) hover:text-(--text)"}`}
              >
                Sign in
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
                className={`border-b-2 px-3 py-3 text-sm font-extrabold ${mode === "signup" ? "border-(--gold) text-(--text)" : "border-transparent text-(--text-muted) hover:text-(--text)"}`}
              >
                Create account
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {sessionMessage && !message ? (
              <p className="mb-5 rounded-lg border border-(--blue) bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] px-3 py-2.5 text-sm text-(--text)" role="status">
                {sessionMessage}
              </p>
            ) : null}

            {mode === "signin" ? (
              <div id={signInPanelId} role="tabpanel" aria-labelledby={`${idPrefix}-signin-tab`}>
                <h2 className="editorial-heading text-2xl font-semibold">Welcome back</h2>
                <p className="mt-1 text-sm leading-6 text-(--text-muted)">Continue learning, join a quiz, or open your staff workspace.</p>
                <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                  <label className="block space-y-1.5" htmlFor={`${idPrefix}-signin-email`}>
                    <span className="text-sm font-bold text-(--text)">Email address</span>
                    <input
                      id={`${idPrefix}-signin-email`}
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      maxLength={254}
                      required
                      className="form-control"
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
                  <button type="submit" disabled={isLoading || !email.trim() || !password} className="btn-primary w-full">
                    {isLoading ? "Signing in…" : "Sign in securely"}
                  </button>
                </form>
              </div>
            ) : (
              <div id={signUpPanelId} role="tabpanel" aria-labelledby={`${idPrefix}-signup-tab`}>
                <h2 className="editorial-heading text-2xl font-semibold">Create your account</h2>
                <p className="mt-1 text-sm leading-6 text-(--text-muted)">Learner accounts need no code. Staff access always requires an invitation.</p>
                <form onSubmit={handleSignUp} className="mt-6 space-y-4">
                  <fieldset>
                    <legend className="text-sm font-bold text-(--text)">Account type</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {([
                        ["learner", "Learner", "Lessons and quizzes"],
                        ["staff", "Staff", "Invite code required"],
                      ] as const).map(([value, label, detail]) => (
                        <label key={value} className={`cursor-pointer rounded-lg border p-3 ${accountKind === value ? "border-(--gold) bg-[color-mix(in_srgb,var(--gold)_8%,transparent)]" : "border-(--border)"}`}>
                          <span className="flex items-start gap-2.5">
                            <input
                              type="radio"
                              name={`${idPrefix}-account-kind`}
                              value={value}
                              checked={accountKind === value}
                              onChange={() => setAccountKind(value)}
                              className="mt-1 accent-(--gold)"
                            />
                            <span>
                              <strong className="block text-sm">{label}</strong>
                              <span className="block text-xs text-(--text-muted)">{detail}</span>
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block space-y-1.5" htmlFor={`${idPrefix}-name`}>
                    <span className="text-sm font-bold text-(--text)">Display name</span>
                    <input id={`${idPrefix}-name`} type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={120} required className="form-control" />
                  </label>
                  <label className="block space-y-1.5" htmlFor={`${idPrefix}-signup-email`}>
                    <span className="text-sm font-bold text-(--text)">Email address</span>
                    <input id={`${idPrefix}-signup-email`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required className="form-control" />
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
                  <p id={passwordHelpId} className="-mt-2 text-xs text-(--text-muted)">Use at least 8 characters. A longer, unique passphrase is safer.</p>
                  <PasswordField
                    id={`${idPrefix}-confirm-password`}
                    label="Confirm password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                    visible={passwordVisible}
                    onToggle={() => setPasswordVisible((current) => !current)}
                  />
                  <label className="block space-y-1.5" htmlFor={`${idPrefix}-phone`}>
                    <span className="text-sm font-bold text-(--text)">Phone <span className="font-normal text-(--text-muted)">(optional)</span></span>
                    <input id={`${idPrefix}-phone`} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" maxLength={32} className="form-control" />
                  </label>
                  {accountKind === "staff" ? (
                    <label className="block space-y-1.5" htmlFor={`${idPrefix}-invite`}>
                      <span className="text-sm font-bold text-(--text)">Staff invite code</span>
                      <input id={`${idPrefix}-invite`} type="text" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoComplete="off" maxLength={128} required className="form-control" />
                    </label>
                  ) : null}
                  <button
                    type="submit"
                    disabled={isLoading || !name.trim() || !email.trim() || password.length < 8 || !confirmPassword || (accountKind === "staff" && !inviteCode.trim())}
                    className="btn-primary w-full"
                  >
                    {isLoading ? "Creating account…" : "Create account"}
                  </button>
                </form>
              </div>
            )}

            {message ? (
              <p
                role={formState === "error" ? "alert" : "status"}
                aria-live="polite"
                className={`mt-5 rounded-lg border px-3 py-2.5 text-sm ${formState === "error" ? "border-(--danger) bg-(--wrong-bg) text-(--danger)" : "border-(--success) bg-(--correct-bg) text-(--success)"}`}
              >
                {message}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-(--border) pt-5 text-xs">
              <Link href="/mobile" className="font-bold text-(--gold-hover) hover:underline sm:hidden">Back to live quiz</Link>
              <button type="button" onClick={clearSession} disabled={isLoading} className="rounded font-semibold text-(--text-muted) hover:text-(--text) disabled:opacity-50">
                Clear saved session
              </button>
            </div>
          </div>
        </section>

        <aside id="auth-help" className="surface-card order-3 scroll-mt-8 p-5 lg:col-start-2 sm:p-6" aria-labelledby="auth-help-title">
          <p className="eyebrow">Account help</p>
          <h2 id="auth-help-title" className="editorial-heading mt-2 text-xl font-semibold">Having trouble?</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-(--text-muted)">
            <li>Use <strong className="text-(--text)">Learner</strong> unless an administrator issued you a staff invite code.</li>
            <li>Diagnostic references in error messages help the site administrator find deployment problems without exposing secrets.</li>
            <li>If an old account is stuck, clear the saved session above and sign in again.</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
