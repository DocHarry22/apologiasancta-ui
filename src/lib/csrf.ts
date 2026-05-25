/**
 * CSRF token utilities.
 *
 * Uses the double-submit pattern: a non-httpOnly CSRF cookie is set at login,
 * and all admin mutation requests must echo its value in the x-csrf-token header.
 *
 * The token value is HMAC-SHA256("csrf-v1:<sessionValue>", AUTHOR_SESSION_SECRET),
 * so the server can verify it without storing any additional state.
 */

const encoder = new TextEncoder();

function toBase64Url(input: Uint8Array): string {
  const binary = String.fromCharCode(...input);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Name of the readable (non-httpOnly) CSRF cookie sent to the browser.
 * SameSite=Strict prevents it from being sent on cross-site navigations.
 */
export const CSRF_COOKIE_NAME = "as_csrf_token";

/**
 * Generate a CSRF token that is deterministic for a given session value.
 * Throws if AUTHOR_SESSION_SECRET is not configured.
 */
export async function generateCsrfToken(sessionValue: string): Promise<string> {
  const secret = process.env.AUTHOR_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTHOR_SESSION_SECRET is not configured");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`csrf-v1:${sessionValue}`)
  );

  return toBase64Url(new Uint8Array(sig));
}

/**
 * Verify a CSRF token candidate against the expected token for the given session value.
 * Returns false on any error rather than throwing.
 */
export async function verifyCsrfToken(
  sessionValue: string,
  candidate: string
): Promise<boolean> {
  try {
    const expected = await generateCsrfToken(sessionValue);
    return safeEqual(expected, candidate);
  } catch {
    return false;
  }
}
