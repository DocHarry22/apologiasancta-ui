import { createHmac, randomBytes } from "node:crypto";

const DEFAULT_ISSUER = "apologia-ui";
const DEFAULT_TTL_SECONDS = 120;
const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 300;
const MIN_SECRET_BYTES = 32;
const ISSUER_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;
const SUBJECT_PATTERN = /^[a-zA-Z0-9:_-]{8,128}$/;
const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/;
const PLACEHOLDER_SECRET_PATTERN = /^(?:replace-with-|change-?me|changeme|placeholder|your-(?:secure-)?account-identity-secret)/i;

export interface AccountIdentityConfiguration {
  enabled: boolean;
  ready: boolean;
  issuer: string;
  assertionTtlSeconds: number;
  engineUrlConfigured: boolean;
  secretConfigured: boolean;
}

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

function hasStrongSecret(value: string | undefined): boolean {
  const secret = value?.trim();
  return Boolean(
    secret
    && Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES
    && !PLACEHOLDER_SECRET_PATTERN.test(secret)
  );
}

export function getAccountIdentityConfiguration(
  env: NodeJS.ProcessEnv = process.env
): AccountIdentityConfiguration {
  const issuer = env.ACCOUNT_IDENTITY_ISSUER?.trim() || DEFAULT_ISSUER;
  const enabled = env.ACCOUNT_IDENTITY_ENABLED?.trim().toLowerCase() === "true";
  const engineUrlConfigured = Boolean(env.ENGINE_INTERNAL_URL?.trim());
  const secretConfigured = hasStrongSecret(env.ACCOUNT_IDENTITY_SECRET);
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
    secretConfigured,
  };
}

export function isValidAccountIdentityInput(input: {
  subject: string;
  displayName: string;
  roomId: string;
}): boolean {
  return SUBJECT_PATTERN.test(input.subject)
    && DISPLAY_NAME_PATTERN.test(input.displayName)
    && ROOM_ID_PATTERN.test(input.roomId);
}

export function createAccountIdentityAssertion(
  input: { subject: string; displayName: string; roomId: string; nonce?: string },
  nowMs = Date.now(),
  env: NodeJS.ProcessEnv = process.env
): string {
  const configuration = getAccountIdentityConfiguration(env);
  const secret = env.ACCOUNT_IDENTITY_SECRET?.trim();
  if (!configuration.ready || !secret) {
    throw new Error("Account identity assertion signing is not configured");
  }
  if (!isValidAccountIdentityInput(input)) {
    throw new Error("Account identity assertion input is invalid");
  }

  const issuedAt = Math.floor(nowMs / 1000);
  const payload: AccountIdentityAssertionPayload = {
    version: 1,
    issuer: configuration.issuer,
    subject: input.subject,
    displayName: input.displayName,
    roomId: input.roomId,
    issuedAt,
    expiresAt: issuedAt + configuration.assertionTtlSeconds,
    nonce: input.nonce ?? randomBytes(18).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function getAccountIdentityExchangeUrl(env: NodeJS.ProcessEnv = process.env): URL | null {
  const configured = env.ENGINE_INTERNAL_URL?.trim();
  if (!configured) return null;
  try {
    const base = new URL(configured.endsWith("/") ? configured : `${configured}/`);
    return new URL("identity/exchange", base);
  } catch {
    return null;
  }
}
