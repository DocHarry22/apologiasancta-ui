import { describe, expect, it } from "vitest";
import { getAdminAuthReadiness } from "./availability";

describe("admin auth readiness", () => {
  it("requires both a session secret and durable production user storage", () => {
    expect(getAdminAuthReadiness({ NODE_ENV: "production" })).toEqual({
      ready: false,
      sessionConfigured: false,
      userStoreConfigured: false,
    });

    expect(getAdminAuthReadiness({
      NODE_ENV: "production",
      AUTHOR_SESSION_SECRET: "a-secure-production-session-secret",
      DATABASE_URL: "postgresql://user:secret@db.example/apologia",
    })).toEqual({
      ready: true,
      sessionConfigured: true,
      userStoreConfigured: true,
    });
  });
});
