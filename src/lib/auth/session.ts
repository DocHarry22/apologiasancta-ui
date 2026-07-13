const encoder = new TextEncoder();

/**
 * The __Host- prefix enforces Secure, Path=/, and no Domain attribute in
 * production (HTTPS). In development the plain name is used so the cookie
 * still works over HTTP.
 */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-as_author_session"
    : "as_author_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
const SESSION_CLOCK_SKEW_MS = 60 * 1000;
const MIN_SESSION_SECRET_LENGTH = 32;
const MAX_SESSION_COOKIE_LENGTH = 4096;

interface SessionPayload {
  v: 2;
  uid: string;
  iat: number;
  exp: number;
}

export function hasValidSessionClaims(payload: unknown, now = Date.now()): payload is SessionPayload {
  if (!payload || typeof payload !== "object") return false;
  const claims = payload as Partial<SessionPayload>;
  return claims.v === 2
    && typeof claims.uid === "string"
    && Boolean(claims.uid.trim())
    && typeof claims.iat === "number"
    && Number.isFinite(claims.iat)
    && typeof claims.exp === "number"
    && Number.isFinite(claims.exp)
    && claims.iat <= now + SESSION_CLOCK_SKEW_MS
    && claims.exp > claims.iat
    && claims.exp - claims.iat <= SESSION_MAX_AGE_MS + SESSION_CLOCK_SKEW_MS
    && claims.exp > now;
}

function toBase64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  const binary = String.fromCharCode(...bytes);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

async function sign(payloadB64: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return toBase64Url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

export interface VerifiedSession {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

export function hasStrongSessionSecret(secret: string | undefined = process.env.AUTHOR_SESSION_SECRET): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SESSION_SECRET_LENGTH;
}

export async function createSessionCookie(userId: string): Promise<string> {
  const secret = process.env.AUTHOR_SESSION_SECRET;
  if (!hasStrongSessionSecret(secret)) {
    throw new Error("AUTHOR_SESSION_SECRET must contain at least 32 characters");
  }

  const now = Date.now();
  const payload: SessionPayload = {
    v: 2,
    uid: userId,
    iat: now,
    exp: now + SESSION_MAX_AGE_MS,
  };

  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = await sign(payloadB64, secret);

  return `${payloadB64}.${sig}`;
}

export async function readSessionCookie(value?: string | null): Promise<VerifiedSession | null> {
  if (!value || value.length > MAX_SESSION_COOKIE_LENGTH) {
    return null;
  }

  const secret = process.env.AUTHOR_SESSION_SECRET;
  if (!hasStrongSessionSecret(secret)) {
    return null;
  }

  const [payloadB64, providedSig, ...rest] = value.split(".");
  if (!payloadB64 || !providedSig || rest.length > 0) {
    return null;
  }

  const expectedSig = await sign(payloadB64, secret);
  if (!safeEqual(expectedSig, providedSig)) {
    return null;
  }

  try {
    const payloadJson = fromBase64Url(payloadB64);
    const payload = JSON.parse(payloadJson) as Partial<SessionPayload>;

    const now = Date.now();
    if (!hasValidSessionClaims(payload, now)) {
      return null;
    }

    return {
      userId: payload.uid,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function verifySessionCookie(value?: string | null): Promise<boolean> {
  return Boolean(await readSessionCookie(value));
}
