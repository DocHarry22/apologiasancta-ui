import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createAccountIdentityAssertion,
  getAccountIdentityConfiguration,
  isValidAccountIdentityInput,
} from "./accountIdentity";

const env = {
  ACCOUNT_IDENTITY_ENABLED: "true",
  ACCOUNT_IDENTITY_SECRET: "test-account-identity-secret-with-more-than-32-bytes",
  ACCOUNT_IDENTITY_ISSUER: "apologia-ui",
  ACCOUNT_IDENTITY_ASSERTION_TTL_SECONDS: "120",
  ENGINE_INTERNAL_URL: "https://engine.test",
} as NodeJS.ProcessEnv;

describe("account identity assertion signer", () => {
  it("signs the exact short-lived Engine contract without identifying account data", () => {
    const assertion = createAccountIdentityAssertion({
      subject: "account_12345678",
      displayName: "Thomas_A",
      roomId: "global",
      nonce: "abcdefghijklmnopqr",
    }, 1_700_000_000_000, env);
    const [encodedPayload, signature] = assertion.split(".");
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    expect(payload).toEqual({
      version: 1,
      issuer: "apologia-ui",
      subject: "account_12345678",
      displayName: "Thomas_A",
      roomId: "global",
      issuedAt: 1_700_000_000,
      expiresAt: 1_700_000_120,
      nonce: "abcdefghijklmnopqr",
    });
    expect(signature).toBe(
      createHmac("sha256", env.ACCOUNT_IDENTITY_SECRET!)
        .update(encodedPayload)
        .digest("base64url")
    );
    expect(assertion).not.toContain(env.ACCOUNT_IDENTITY_SECRET!);
  });

  it("stays disabled until every server-only requirement is ready", () => {
    expect(getAccountIdentityConfiguration(env)).toEqual(expect.objectContaining({
      enabled: true,
      ready: true,
      secretConfigured: true,
      engineUrlConfigured: true,
    }));
    expect(getAccountIdentityConfiguration({ ...env, ACCOUNT_IDENTITY_ENABLED: "false" }).ready).toBe(false);
    expect(getAccountIdentityConfiguration({ ...env, ACCOUNT_IDENTITY_SECRET: "too-short" }).ready).toBe(false);
    expect(getAccountIdentityConfiguration({ ...env, ENGINE_INTERNAL_URL: "" }).ready).toBe(false);
  });

  it("rejects mutable or unsafe account assertion fields", () => {
    expect(isValidAccountIdentityInput({ subject: "account_12345678", displayName: "Thomas_A", roomId: "global" })).toBe(true);
    expect(isValidAccountIdentityInput({ subject: "person@example.com", displayName: "Thomas_A", roomId: "global" })).toBe(false);
    expect(isValidAccountIdentityInput({ subject: "account_12345678", displayName: "Thomas Aquinas", roomId: "global" })).toBe(false);
    expect(isValidAccountIdentityInput({ subject: "account_12345678", displayName: "Thomas_A", roomId: "../../admin" })).toBe(false);
  });
});
