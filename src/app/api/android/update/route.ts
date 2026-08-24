import { NextResponse } from "next/server";

const RELEASES_API = "https://api.github.com/repos/DocHarry22/apologiasancta-ui/releases?per_page=20";
const UPDATE_ASSET_NAME = "android-update.json";
const APK_ASSET_NAME = "apologia-sancta.apk";
const EXPECTED_PACKAGE = "com.apologiasancta.live";
const RELEASE_TAG_PATTERN = /^android-v[0-9A-Za-z._-]+$/;
const MAX_RELEASES = 20;
const MAX_APK_BYTES = 80 * 1024 * 1024;

type GithubAsset = {
  id?: unknown;
  name?: unknown;
  size?: unknown;
  browser_download_url?: unknown;
};
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

type UpdateCandidate = UpdateManifest & {
  apkAssetId: number;
  apkAssetApiUrl: string;
};

function exactReleaseUrl(tag: string): string {
  return `https://github.com/DocHarry22/apologiasancta-ui/releases/tag/${encodeURIComponent(tag)}`;
}

function exactApkUrl(tag: string): string {
  return `https://github.com/DocHarry22/apologiasancta-ui/releases/download/${encodeURIComponent(tag)}/${APK_ASSET_NAME}`;
}

function parseManifest(value: unknown): UpdateManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const schemaVersion = Number(input.schemaVersion);
  const versionCode = Number(input.versionCode);
  if (schemaVersion !== 1 || input.packageName !== EXPECTED_PACKAGE) return null;
  if (!Number.isInteger(versionCode) || versionCode < 1) return null;
  if (typeof input.versionName !== "string" || !/^[0-9A-Za-z._-]+$/.test(input.versionName)) return null;
  if (typeof input.apkUrl !== "string" || typeof input.releaseUrl !== "string") return null;
  if (typeof input.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(input.sha256)) return null;
  if (typeof input.publishedAt !== "string" || Number.isNaN(Date.parse(input.publishedAt))) return null;
  return {
    schemaVersion: 1,
    packageName: EXPECTED_PACKAGE,
    versionCode,
    versionName: input.versionName.slice(0, 80),
    apkUrl: input.apkUrl,
    releaseUrl: input.releaseUrl,
    sha256: input.sha256.toLowerCase(),
    publishedAt: input.publishedAt,
  };
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function candidateForRelease(release: GithubRelease): Promise<UpdateCandidate | null> {
  if (
    release?.draft === true ||
    release?.prerelease === true ||
    typeof release?.tag_name !== "string" ||
    !RELEASE_TAG_PATTERN.test(release.tag_name) ||
    !Array.isArray(release.assets)
  ) return null;

  const tag = release.tag_name;
  const assets = release.assets as GithubAsset[];
  const manifestAsset = assets.find((asset) => asset?.name === UPDATE_ASSET_NAME);
  const apkAsset = assets.find((asset) => asset?.name === APK_ASSET_NAME);
  const apkAssetId = positiveInteger(apkAsset?.id);
  const apkSize = positiveInteger(apkAsset?.size);
  if (
    !manifestAsset ||
    typeof manifestAsset.browser_download_url !== "string" ||
    !apkAsset ||
    !apkAssetId ||
    !apkSize ||
    apkSize > MAX_APK_BYTES ||
    apkAsset.browser_download_url !== exactApkUrl(tag)
  ) return null;

  const manifestResponse = await fetch(manifestAsset.browser_download_url, {
    headers: { "User-Agent": "Apologia-Sancta-Updater" },
    next: { revalidate: 300 },
  });
  if (!manifestResponse.ok) return null;
  const manifest = parseManifest(await manifestResponse.json());
  if (!manifest) return null;
  if (manifest.apkUrl !== exactApkUrl(tag) || manifest.releaseUrl !== exactReleaseUrl(tag)) return null;

  return {
    ...manifest,
    apkUrl: manifest.apkUrl,
    releaseUrl: exactReleaseUrl(tag),
    apkAssetId,
    apkAssetApiUrl: `https://api.github.com/repos/DocHarry22/apologiasancta-ui/releases/assets/${apkAssetId}`,
  };
}

export async function GET(request: Request) {
  try {
    const releasesResponse = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Apologia-Sancta-Updater" },
      next: { revalidate: 300 },
    });
    if (!releasesResponse.ok) throw new Error(`release lookup failed: ${releasesResponse.status}`);
    const releaseValue = await releasesResponse.json();
    const releases = Array.isArray(releaseValue) ? releaseValue.slice(0, MAX_RELEASES) as GithubRelease[] : [];
    const candidates = (await Promise.all(releases.map((release) => candidateForRelease(release))))
      .filter((candidate): candidate is UpdateCandidate => Boolean(candidate))
      .sort((left, right) =>
        right.versionCode - left.versionCode ||
        Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
      );
    const candidate = candidates[0];
    if (!candidate) {
      return NextResponse.json({ available: false }, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
    }

    const downloadUrl = new URL("/api/android/update/apk", request.url);
    downloadUrl.searchParams.set("assetId", String(candidate.apkAssetId));
    downloadUrl.searchParams.set("sha256", candidate.sha256);

    return NextResponse.json({
      available: true,
      update: {
        ...candidate,
        apkUrl: downloadUrl.toString(),
      },
    }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ available: false, error: "update_check_unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
