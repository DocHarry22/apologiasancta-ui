import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_ISSUER = "apologia-ui";
const DEFAULT_TTL_SECONDS = 120;
const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 300;
const MIN_SECRET_BYTES = 32;
const ISSUER_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;
const SUBJECT_PATTERN = /^[a-zA-Z0-9:_-]{8,128}$/;
const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/;
const MOBILE_ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const NONCE_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/;
const ACCOUNT_SESSION_BINDING_CONTEXT = "apologia-account-session-v1";
const MAX_SESSION_VALUE_LENGTH = 4096;
const PLACEHOLDER_SECRET_PATTERNS = [
  /^replace-with-/i,
  /^your-(?:secure-)?account-identity-secret$/i,
  /^(?:change-?me|changeme|placeholder)$/i,
  /^apologia-sancta-local-account-identity-secret$/i,
  /^apologia-sancta-local-join-token-secret$/i,
];

export interface AccountIdentityConfiguration {
  enabled: boolean;
  ready: boolean;
  issuer: string;
  assertionTtlSeconds: number;
  engineUrlConfigured: boolean;
  secretPresent: boolean;
  secretConfigured: boolean;
}

export type AccountIdentityInputClassification = "valid" | "unsupported_room" | "invalid";

export interface AccountIdentityAssertionPayload {
  version: 1;
  issuer: string;
  subject: string;
  displayName: string;
  roomId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

function boundedTtl(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, parsed));
}

function secretsMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function hasStrongDedicatedSecret(value: string | undefined, env: NodeJS.ProcessEnv): boolean {
  const secret = value?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) return false;
  if (PLACEHOLDER_SECRET_PATTERNS.some((pattern) => pattern.test(secret))) return false;

  // Hostinger knows the UI session/admin secrets even though PLAYER_JOIN_SECRET
  // belongs only to the Engine. Reject the known local secret-reuse cases here;
  // the Engine independently rejects reuse with PLAYER_JOIN_SECRET.
  return [env.AUTHOR_SESSION_SECRET, env.ENGINE_ADMIN_TOKEN]
    .map((candidate) => candidate?.trim())
    .filter((candidate): candidate is string => Boolean(candidate))
    .every((candidate) => !secretsMatch(secret, candidate));
}

function parseEngineBaseUrl(env: NodeJS.ProcessEnv): URL | null {
  const configured = env.ENGINE_INTERNAL_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured.endsWith("/") ? configured : `${configured}/`);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol === "https:") return url;

    const localDevelopmentHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol === "http:" && env.NODE_ENV !== "production" && localDevelopmentHost) return url;
    return null;
  } catch {
    return null;
  }
}

export function getAccountIdentityConfiguration(
  env: NodeJS.ProcessEnv = process.env
): AccountIdentityConfiguration {
  const issuer = env.ACCOUNT_IDENTITY_ISSUER?.trim() || DEFAULT_ISSUER;
  const enabled = env.ACCOUNT_IDENTITY_ENABLED?.trim().toLowerCase() === "true";
  const engineUrlConfigured = parseEngineBaseUrl(env) !== null;
  const secretPresent = Boolean(env.ACCOUNT_IDENTITY_SECRET?.trim());
  const secretConfigured = hasStrongDedicatedSecret(env.ACCOUNT_IDENTITY_SECRET, env);
  const ready = enabled
    && engineUrlConfigured
    && secretConfigured
    && ISSUER_PATTERN.test(issuer);

  return {
    enabled,
    ready,
    issuer,
    assertionTtlSeconds: boundedTtl(env.ACCOUNT_IDENTITY_ASSERTION_TTL_SECONDS),
    engineUrlConfigured,
    secretPresent,
    secretConfigured,
  };
}

export function classifyAccountIdentityInput(input: {
  subject: string;
  displayName: string;
  roomId: string;
}): AccountIdentityInputClassification {
  if (!SUBJECT_PATTERN.test(input.subject) || !DISPLAY_NAME_PATTERN.test(input.displayName)) {
    return "invalid";
  }
  if (ROOM_ID_PATTERN.test(input.roomId)) return "valid";

  // Older mobile links accepted a wider room alphabet than the signed Engine
  // contract. Those IDs must fall back to guest registration instead of
  // blocking an otherwise valid signed-in learner.
  return MOBILE_ROOM_ID_PATTERN.test(input.roomId) ? "unsupported_room" : "invalid";
}

export function isValidAccountIdentityInput(input: {
  subject: string;
  displayName: string;
  roomId: string;
}): boolean {
  return classifyAccountIdentityInput(input) === "valid";
}

function getDedicatedSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.ACCOUNT_IDENTITY_SECRET?.trim();
  if (!secret || !hasStrongDedicatedSecret(secret, env)) {
    throw new Error("Account identity assertion signing is not configured");
  }
  return secret;
}

export function createAccountIdentityAssertion(
  input: { subject: string; displayName: string; roomId: string; nonce?: string },
  nowMs = Date.now(),
  env: NodeJS.ProcessEnv = process.env
): string {
  const configuration = getAccountIdentityConfiguration(env);
  if (!configuration.ready) {
    throw new Error("Account identity assertion signing is not configured");
  }
  if (!isValidAccountIdentityInput(input)) {
    throw new Error("Account identity assertion input is invalid");
  }

  const issuedAt = Math.floor(nowMs / 1000);
  const nonce = input.nonce ?? randomBytes(18).toString("base64url");
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("Account identity assertion nonce is invalid");
  }

  const payload: AccountIdentityAssertionPayload = {
    version: 1,
    issuer: configuration.issuer,
    subject: input.subject,
    displayName: input.displayName,
    roomId: input.roomId,
    issuedAt,
    expiresAt: issuedAt + configuration.assertionTtlSeconds,
    nonce,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", getDedicatedSecret(env)).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

/**
 * Browser-readable, one-way binding for an account-linked room credential.
 * It is scoped to the current HTTP-only session cookie and domain-separated
 * from the Engine assertion signature. Neither the session nor account ID is
 * persisted in browser storage.
 */
export function createAccountIdentitySessionBinding(
  sessionValue: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (!sessionValue || sessionValue.length > MAX_SESSION_VALUE_LENGTH) {
    throw new Error("Account identity session binding input is invalid");
  }
  return createHmac("sha256", getDedicatedSecret(env))
    .update(`${ACCOUNT_SESSION_BINDING_CONTEXT}:${sessionValue}`)
    .digest("base64url");
}

export function getAccountIdentityExchangeUrl(env: NodeJS.ProcessEnv = process.env): URL | null {
  const base = parseEngineBaseUrl(env);
  return base ? new URL("identity/exchange", base) : null;
}
