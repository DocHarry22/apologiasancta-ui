"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FormState = "idle" | "loading" | "error";

export default function AuthorLoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

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
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const params = new URLSearchParams(window.location.search);
        const candidate = params.get("next");
        const nextPath = candidate && candidate.startsWith("/author") ? candidate : "/author";
        router.push(nextPath);
        router.refresh();
        return;
      }

      if (response.status === 401) {
        setError("Incorrect password. Please try again.");
      } else if (response.status === 429) {
        setError("Too many login attempts. Please wait a bit and try again.");
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
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-(--muted)">Author Access</p>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-(--muted)">Enter the author password to access the dashboard.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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
            <p className="text-xs rounded-md border border-(--wrong)/30 bg-(--wrong)/10 text-(--wrong) px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={state === "loading" || !password.trim()}
            className="w-full rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === "loading" ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs">
          <Link href="/" className="text-(--muted) hover:text-(--accent)">
            Back to Home
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
      </section>
    </main>
  );
}
