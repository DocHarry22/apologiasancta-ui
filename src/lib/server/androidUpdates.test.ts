import { describe, expect, it, vi } from "vitest";
import { ANDROID_APPLICATION_ID, ANDROID_RELEASES_URL } from "@/lib/androidUpdates";
import { getLatestAndroidUpdate } from "./androidUpdates";

const release = {
  tag_name: "android-v1.0.4", draft: false, prerelease: false,
  assets: ["apologia-sancta.apk", "android-update.json"].map((name) => ({ name, browser_download_url: `${ANDROID_RELEASES_URL}/download/android-v1.0.4/${name}` })),
};
const manifest = {
  schemaVersion: 1, applicationId: ANDROID_APPLICATION_ID, versionCode: 4, versionName: "1.0.4",
  apkUrl: release.assets[0].browser_download_url, releaseUrl: `${ANDROID_RELEASES_URL}/tag/android-v1.0.4`,
  apkSha256: "a".repeat(64), signingCertSha256: "b".repeat(64),
};

describe("published Android release feed", () => {
  it("ignores drafts, prereleases, and web releases and returns verified Android metadata", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([
      { ...release, draft: true }, { ...release, prerelease: true }, { tag_name: "web-v2", assets: [] }, release,
    ])).mockResolvedValueOnce(Response.json(manifest));
    expect(await getLatestAndroidUpdate(fetcher)).toEqual(manifest);
    expect(fetcher.mock.calls[1][0]).toBe(release.assets[1].browser_download_url);
  });
  it("does not infer build codes from old releases or offer an older release as a fallback", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ ...release, assets: [release.assets[0]] }, release]));
    expect(await getLatestAndroidUpdate(fetcher)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("fails closed on an untrusted metadata URL", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([{ ...release, assets: [release.assets[0], { name: "android-update.json", browser_download_url: "https://evil.test/update.json" }] }]));
    await expect(getLatestAndroidUpdate(fetcher)).rejects.toThrow(/Untrusted/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects manifests inconsistent with the published release and contains upstream errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([release])).mockResolvedValueOnce(Response.json({ ...manifest, versionName: "1.0.5" }));
    await expect(getLatestAndroidUpdate(fetcher)).rejects.toThrow(/Invalid/);
    await expect(getLatestAndroidUpdate(vi.fn<typeof fetch>().mockResolvedValue(new Response("rate limited", { status: 429 })))).rejects.toThrow(/unavailable/);
  });
});
