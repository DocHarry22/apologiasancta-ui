import { NextResponse } from "next/server";

const RELEASES_API = "https://api.github.com/repos/DocHarry22/apologiasancta-ui/releases?per_page=20";
const UPDATE_ASSET_NAME = "android-update.json";
const EXPECTED_PACKAGE = "com.apologiasancta.live";

type GithubAsset = { name?: unknown; browser_download_url?: unknown };
type GithubRelease = {
  tag_name?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
};

type UpdateManifest = {
  schemaVersion: number;
  packageName: string;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseUrl: string;
  sha256: string;
  publishedAt: string;
};

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function parseManifest(value: unknown): UpdateManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const versionCode = Number(input.versionCode);
  if (input.packageName !== EXPECTED_PACKAGE) return null;
  if (!Number.isInteger(versionCode) || versionCode < 1) return null;
  if (typeof input.versionName !== "string" || !input.versionName.trim()) return null;
  if (!isHttpsUrl(input.apkUrl) || !isHttpsUrl(input.releaseUrl)) return null;
  if (typeof input.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(input.sha256)) return null;
  if (typeof input.publishedAt !== "string" || Number.isNaN(Date.parse(input.publishedAt))) return null;
  return {
    schemaVersion: 1,
    packageName: EXPECTED_PACKAGE,
    versionCode,
    versionName: input.versionName.trim().slice(0, 80),
    apkUrl: input.apkUrl,
    releaseUrl: input.releaseUrl,
    sha256: input.sha256.toLowerCase(),
    publishedAt: input.publishedAt,
  };
}

export async function GET() {
  try {
    const releasesResponse = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Apologia-Sancta-Updater" },
      next: { revalidate: 300 },
    });
    if (!releasesResponse.ok) throw new Error(`release lookup failed: ${releasesResponse.status}`);
    const releases = await releasesResponse.json() as GithubRelease[];
    const release = releases.find((item) =>
      item?.draft !== true &&
      item?.prerelease !== true &&
      typeof item?.tag_name === "string" &&
      item.tag_name.startsWith("android-v"),
    );
    if (!release || !Array.isArray(release.assets)) {
      return NextResponse.json({ available: false }, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
    }
    const asset = (release.assets as GithubAsset[]).find((item) => item?.name === UPDATE_ASSET_NAME);
    if (!asset || !isHttpsUrl(asset.browser_download_url)) {
      return NextResponse.json({ available: false }, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
    }
    const manifestResponse = await fetch(asset.browser_download_url, { next: { revalidate: 300 } });
    if (!manifestResponse.ok) throw new Error(`manifest fetch failed: ${manifestResponse.status}`);
    const manifest = parseManifest(await manifestResponse.json());
    if (!manifest) throw new Error("invalid Android update manifest");
    return NextResponse.json({ available: true, update: manifest }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ available: false, error: "update_check_unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
