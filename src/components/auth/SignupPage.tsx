"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FormState = "idle" | "loading" | "error";

interface SignupPayload {
  redirectTo?: string;
  error?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("loading");
    setError("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
          phone,
          inviteCode,
        }),
      });

      if (response.ok) {
        const payload = (await response.json().catch(() => null)) as SignupPayload | null;
        router.push(payload?.redirectTo || "/");
        router.refresh();
        return;
      }

      const payload = (await response.json().catch(() => null)) as SignupPayload | null;
      setState("error");
      setError(payload?.error || "Unable to create account right now. Please try again.");
    } catch {
      setState("error");
      setError("Network error. Please check your connection and retry.");
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-xl border border-(--border) bg-(--card) p-5 sm:p-6 space-y-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-(--border) px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-(--muted)">
            <span aria-hidden>+</span>
            <span>Apologia Sancta</span>
          </div>
          <p className="text-xs uppercase tracking-widest text-(--muted)">Create account</p>
          <h1 className="text-2xl font-semibold">Sign up</h1>
          <p className="text-sm text-(--muted)">Create a user account. Add an invite code only if you were issued staff access.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-(--muted)">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
            />
          </label>

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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-(--muted)">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-(--muted)">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-(--muted)">Phone (optional)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-(--muted)">Invite code (staff only)</span>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
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
            disabled={
              state === "loading" ||
              !name.trim() ||
              !email.trim() ||
              !password.trim() ||
              !confirmPassword.trim()
            }
            className="w-full rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === "loading" ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs">
          <Link href="/" className="text-(--muted) hover:text-(--accent)">
            Back home
          </Link>
          <Link href="/admin/login" className="text-(--muted) hover:text-(--accent)">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
