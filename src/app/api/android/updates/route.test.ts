import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getLatestAndroidUpdate } from "@/lib/server/androidUpdates";

vi.mock("@/lib/server/androidUpdates", () => ({ getLatestAndroidUpdate: vi.fn() }));
describe("public Android update endpoint", () => {
  beforeEach(() => { vi.mocked(getLatestAndroidUpdate).mockReset(); });
  it("returns no available APK without a verified release, including for signed-out users", async () => {
    vi.mocked(getLatestAndroidUpdate).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ update: null });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("contains lookup failures instead of claiming the installed app is current", async () => {
    vi.mocked(getLatestAndroidUpdate).mockRejectedValue(new Error("internal upstream diagnostic"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("internal upstream diagnostic");
  });
});
