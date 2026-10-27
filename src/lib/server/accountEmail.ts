import { createHash } from "node:crypto";
import { issueAccountEmailToken, takeAccountEmailLimit, type AccountEmailPurpose } from "./adminUserStore";

function publicAppUrl(): URL {
  const url = new URL(process.env.AUTH_PUBLIC_URL || "");
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:"))) {
    throw new Error("Invalid account email configuration");
  }
  return url;
}

export function hasAccountEmailConfiguration(): boolean {
  try {
    publicAppUrl();
    return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim());
  } catch { return false; }
}

export async function sendAccountEmail(to: string, subject: string, text: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  // Provider responses can contain addresses and links. Never log them.
  if (!response.ok) throw new Error("Account email delivery unavailable");
}

export async function requestAccountEmail(email: string, purpose: AccountEmailPurpose): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  // Count nonexistent and inactive accounts too, with the same public response.
  const key = createHash("sha256").update(`email:${normalizedEmail}`).digest("hex");
  if (!(await takeAccountEmailLimit(key, 5, 60 * 60 * 1000)).allowed) return;
  const issued = await issueAccountEmailToken(normalizedEmail, purpose);
  if (!issued) return;
  const url = publicAppUrl();
  url.pathname = `${url.pathname.replace(/\/$/, "")}/${purpose === "reset" ? "reset-password" : "verify-email"}`;
  // Fragments stay out of HTTP requests, access logs, and Referer headers.
  url.hash = new URLSearchParams({ token: issued.token }).toString();
  await sendAccountEmail(normalizedEmail,
    purpose === "reset" ? "Reset your Apologia Sancta password" : "Verify your Apologia Sancta email",
    purpose === "reset"
      ? `Use this single-use link within 30 minutes to choose a new password:\n\n${url}\n\nAll signed-in sessions will end after recovery. If you did not request this, you can ignore this email.`
      : `Confirm your email address using this single-use link within 24 hours:\n\n${url}\n\nIf you did not create or verify an account, you can ignore this email.`);
}
