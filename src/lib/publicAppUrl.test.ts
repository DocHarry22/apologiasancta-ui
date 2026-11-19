import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_APP_ORIGIN,
  getPublicAppOrigin,
  getPublicAppUrl,
} from "./publicAppUrl";

function environment(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe("public application URL", () => {
  it("canonicalizes casing, trailing slashes, paths, queries, and fragments to one origin", () => {
    const env = environment({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "  HTTPS://SANDYBROWN-BEAR-488955.HOSTINGERSITE.COM///configured?source=hostinger#deploy  ",
    });

    expect(getPublicAppOrigin(env)).toBe(DEFAULT_PUBLIC_APP_ORIGIN);
    expect(getPublicAppUrl("/learn", env)).toBe(`${DEFAULT_PUBLIC_APP_ORIGIN}/learn`);
    expect(getPublicAppUrl("practice", env)).toBe(`${DEFAULT_PUBLIC_APP_ORIGIN}/practice`);
    expect(getPublicAppUrl("/", env)).toBe(`${DEFAULT_PUBLIC_APP_ORIGIN}/`);
  });

  it("rejects credentials and insecure production origins", () => {
    expect(getPublicAppOrigin(environment({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://user:password@example.test/app",
    }))).toBe(DEFAULT_PUBLIC_APP_ORIGIN);

    expect(getPublicAppOrigin(environment({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "http://example.test",
    }))).toBe(DEFAULT_PUBLIC_APP_ORIGIN);
  });

  it("allows local HTTP origins only in development, including bracketed IPv6 loopback", () => {
    const development = environment({ NODE_ENV: "development" });

    expect(getPublicAppOrigin(development, "http://127.0.0.1:3000/path"))
      .toBe("http://127.0.0.1:3000");
    expect(getPublicAppUrl("/library", development, "http://localhost:3000/"))
      .toBe("http://localhost:3000/library");
    expect(getPublicAppOrigin(environment({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://[::1]:3000/configured",
    }))).toBe("http://[::1]:3000");
    expect(getPublicAppUrl("/author/login", development, "http://[::1]:3000/request"))
      .toBe("http://[::1]:3000/author/login");
  });
});
