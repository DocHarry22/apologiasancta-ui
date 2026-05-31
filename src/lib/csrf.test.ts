import { describe, expect, it } from "vitest";
import { generateCsrfToken, verifyCsrfToken } from "./csrf";

describe("CSRF tokens", () => {
  it("creates a valid CSRF token", async () => {
    const token = await generateCsrfToken("session-value");

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    await expect(verifyCsrfToken("session-value", token)).resolves.toBe(true);
  });

  it("rejects missing, malformed, tampered, and mismatched tokens", async () => {
    const token = await generateCsrfToken("session-value");

    await expect(verifyCsrfToken("session-value", "")).resolves.toBe(false);
    await expect(verifyCsrfToken("session-value", "not-a-valid-token")).resolves.toBe(false);
    await expect(verifyCsrfToken("session-value", `${token.slice(0, -1)}x`)).resolves.toBe(false);
    await expect(verifyCsrfToken("other-session", token)).resolves.toBe(false);
  });
});
