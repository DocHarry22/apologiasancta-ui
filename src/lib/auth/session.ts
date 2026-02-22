const encoder = new TextEncoder();

export const SESSION_COOKIE_NAME = "as_author_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

interface SessionPayload {
  v: 1;
  iat: number;
  exp: number;
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

export async function createSessionCookie(): Promise<string> {
  const secret = process.env.AUTHOR_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTHOR_SESSION_SECRET is not configured");
  }

  const now = Date.now();
  const payload: SessionPayload = {
    v: 1,
    iat: now,
    exp: now + SESSION_MAX_AGE_MS,
  };

  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = await sign(payloadB64, secret);

  return `${payloadB64}.${sig}`;
}

export async function verifySessionCookie(value?: string | null): Promise<boolean> {
  if (!value) {
    return false;
  }

  const secret = process.env.AUTHOR_SESSION_SECRET;
  if (!secret) {
    return false;
  }

  const [payloadB64, providedSig, ...rest] = value.split(".");
  if (!payloadB64 || !providedSig || rest.length > 0) {
    return false;
  }

  const expectedSig = await sign(payloadB64, secret);
  if (!safeEqual(expectedSig, providedSig)) {
    return false;
  }

  try {
    const payloadJson = fromBase64Url(payloadB64);
    const payload = JSON.parse(payloadJson) as Partial<SessionPayload>;

    if (payload.v !== 1 || typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return false;
    }

    if (payload.exp <= Date.now()) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
