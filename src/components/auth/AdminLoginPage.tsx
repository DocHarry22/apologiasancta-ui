"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type FormState = "idle" | "loading" | "error";

interface Props {
  defaultNextPath: string;
  allowedNextPrefixes: string[];
}

interface LoginPayload {
  redirectTo?: string;
  error?: string;
  code?: string;
  reason?: string;
  diagnosticId?: string;
}

function unavailableMessage(payload: LoginPayload | null): string {
  const reasonMessages: Record<string, string> = {
    session_secret_missing: "The server session secret is missing.",
    database_configuration_missing: "The server database configuration is incomplete.",
    database_url_invalid: "The configured database URL is unsupported.",
    database_access_denied: "The database rejected the configured username or password.",
    database_permission_denied: "The database user does not have the required table permissions.",
    database_not_found: "The configured database does not exist or is not assigned to this user.",
    database_host_not_found: "The database hostname could not be resolved.",
    database_connection_refused: "The database server refused the connection.",
    database_connection_timeout: "The database connection timed out.",
    database_tls_failed: "The secure database connection could not be established.",
    database_schema_incompatible: "The database server rejected the required schema statement.",
    database_initialization_failed: "The database could not be initialized.",
  };
  const detail = payload?.reason ? reasonMessages[payload.reason] : undefined;
  const reference = payload?.diagnosticId
    ? ` Diagnostic reference: ${payload.diagnosticId}.`
    : "";

  return `${detail || "Admin sign-in is temporarily unavailable."}${reference}`;
}

function AdminLoginContent({ defaultNextPath, allowedNextPrefixes }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const reason = searchParams.get("reason");
  const reasonMessage = reason === "session_expired"
    ? "Your session expired or was revoked. Please sign in again."
    : "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("loading");
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const payload = (await response.json().catch(() => null)) as LoginPayload | null;
        const params = new URLSearchParams(window.location.search);
        const candidate = params.get("next");
        const fallbackPath = payload?.redirectTo || defaultNextPath;
        const nextPath = candidate && allowedNextPrefixes.some((prefix) => candidate.startsWith(prefix))
          ? candidate
          : fallbackPath;
        router.push(nextPath);
        router.refresh();
        return;
      }

      if (response.status === 401) {
        setError("Incorrect email or password. Please try again.");
      } else if (response.status === 429) {
        setError("Too many login attempts. Please wait a bit and try again.");
      } else if (response.status === 503) {
        const payload = (await response.json().catch(() => null)) as LoginPayload | null;
        setError(unavailableMessage(payload));
      } else {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || "Unable to sign in right now. Please try again.");
      }

      setState("error");
    } catch {
      setState("error");
      setError("Network error. Please check your connection and retry.");
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-xl border border-(--border) bg-(--card) p-5 sm:p-6 space-y-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-(--border) px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-(--muted)">
            <span aria-hidden>+</span>
            <span>Apologia Sancta</span>
          </div>
          <p className="text-xs uppercase tracking-widest text-(--muted)">Admin Access</p>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-(--muted)">Enter your admin email and password to access the dashboard.</p>
        </div>

        {reasonMessage && !error && (
          <p className="text-xs rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300 px-3 py-2">
            {reasonMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-(--muted)">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-(--muted)">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
            />
          </label>

          {error && (
            <p role="alert" aria-live="polite" className="text-xs rounded-md border border-(--wrong)/30 bg-(--wrong)/10 text-(--wrong) px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={state === "loading" || !email.trim() || !password.trim()}
            className="w-full rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === "loading" ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs">
          <Link href="/mobile" className="text-(--muted) hover:text-(--accent)">
            Back to Quiz
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/signup" className="text-(--muted) hover:text-(--accent)">
              Sign up
            </Link>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.refresh();
              }}
              className="text-(--muted) hover:text-(--accent)"
            >
              Clear session
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoginFallback() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-xl border border-(--border) bg-(--card) p-5 sm:p-6">
        <p className="text-sm text-(--muted)">Loading login...</p>
      </section>
    </main>
  );
}

export default function AdminLoginPage({ defaultNextPath, allowedNextPrefixes }: Props) {
  return (
    <Suspense fallback={<LoginFallback />}>
      <AdminLoginContent defaultNextPath={defaultNextPath} allowedNextPrefixes={allowedNextPrefixes} />
    </Suspense>
  );
}
