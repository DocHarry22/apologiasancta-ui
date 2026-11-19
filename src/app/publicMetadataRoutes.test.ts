import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

afterEach(() => vi.unstubAllEnvs());

describe("public metadata routes", () => {
  it("emits canonical sitemap URLs when the deployment origin has casing and trailing slashes", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "HTTPS://SANDYBROWN-BEAR-488955.HOSTINGERSITE.COM///");

    const entries = sitemap();
    expect(entries[0].url).toBe("https://sandybrown-bear-488955.hostingersite.com/");
    expect(entries.map((entry) => entry.url)).toContain("https://sandybrown-bear-488955.hostingersite.com/learn");
    expect(entries.every((entry) => !new URL(entry.url).pathname.startsWith("//"))).toBe(true);
  });

  it("publishes the canonical sitemap address to crawlers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "HTTPS://SANDYBROWN-BEAR-488955.HOSTINGERSITE.COM///");

    expect(robots().sitemap).toBe("https://sandybrown-bear-488955.hostingersite.com/sitemap.xml");
  });
});
