import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_API_PREFIX = "https://api.github.com/repos/DocHarry22/apologiasancta-ui/releases/assets/";
const MAX_APK_BYTES = 80 * 1024 * 1024;

function validSha256(value: string | null): value is string {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value));
}

function validAssetId(value: string | null): value is string {
  return Boolean(value && /^[1-9][0-9]{0,19}$/.test(value));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId");
  const expectedSha = url.searchParams.get("sha256");
  if (!validAssetId(assetId) || !validSha256(expectedSha)) {
    return Response.json({ error: "invalid_update_asset" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const upstream = await fetch(`${ASSET_API_PREFIX}${assetId}`, {
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": "Apologia-Sancta-Updater",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!upstream.ok) throw new Error(`asset download failed: ${upstream.status}`);
    const advertisedLength = Number(upstream.headers.get("content-length") || 0);
    if (advertisedLength > MAX_APK_BYTES) throw new Error("Android update asset exceeds size limit");

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_APK_BYTES) throw new Error("Android update asset exceeds size limit");
    const actual = Buffer.from(createHash("sha256").update(buffer).digest("hex"), "hex");
    const expected = Buffer.from(expectedSha.toLowerCase(), "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error("Android update asset digest mismatch");
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="apologia-sancta.apk"',
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "update_asset_unavailable" }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
