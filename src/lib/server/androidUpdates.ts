import { ANDROID_RELEASES_URL, parseAndroidUpdate, type AndroidUpdate } from "@/lib/androidUpdates";

const RELEASE_API = "https://api.github.com/repos/DocHarry22/apologiasancta-ui/releases?per_page=20";
type Release = { draft?: boolean; prerelease?: boolean; tag_name?: string; assets?: { name?: string; browser_download_url?: string }[] };

export async function getLatestAndroidUpdate(fetcher: typeof fetch = fetch): Promise<AndroidUpdate | null> {
  const options = { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) };
  const response = await fetcher(RELEASE_API, { ...options, headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error("Android release lookup unavailable");
  const releases: unknown = await response.json();
  if (!Array.isArray(releases)) throw new Error("Invalid Android release list");
  const latest = (releases as Release[]).find((release) => release && !release.draft && !release.prerelease &&
    /^android-v\d+\.\d+\.\d+$/.test(release.tag_name ?? "") && Array.isArray(release.assets) &&
    release.assets.some((asset) => asset?.name === "apologia-sancta.apk"));
  if (!latest) return null;
  const metadata = latest.assets?.find((asset) => asset.name === "android-update.json");
  // Older releases without verified build metadata cannot be compared safely.
  if (!metadata) return null;
  const downloadRoot = `${ANDROID_RELEASES_URL}/download/${latest.tag_name}`;
  if (metadata.browser_download_url !== `${downloadRoot}/android-update.json` ||
      !latest.assets?.some((asset) => asset.name === "apologia-sancta.apk" && asset.browser_download_url === `${downloadRoot}/apologia-sancta.apk`)) {
    throw new Error("Untrusted Android release assets");
  }
  const manifestResponse = await fetcher(metadata.browser_download_url, {
    next: { revalidate: 300 }, signal: AbortSignal.timeout(8000),
  });
  if (!manifestResponse.ok) throw new Error("Android release metadata unavailable");
  const update = parseAndroidUpdate(await manifestResponse.json());
  if (!update || latest.tag_name !== `android-v${update.versionName}`) throw new Error("Invalid Android release metadata");
  return update;
}
