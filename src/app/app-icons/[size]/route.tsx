import { ImageResponse } from "next/og";

const SUPPORTED_SIZES = new Set([180, 192, 512]);

function createIconMarkup(size: number) {
  const accentGlow = size >= 512 ? "0 0 90px rgba(212, 175, 55, 0.25)" : "0 0 30px rgba(212, 175, 55, 0.25)";
  const badgeSize = Math.round(size * 0.58);
  const titleSize = Math.round(size * 0.24);
  const subtitleSize = Math.round(size * 0.08);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #221f1b 0%, #120f0d 100%)",
        color: "#f6f0e3",
        fontFamily: "Georgia, serif",
        position: "relative",
      }}
    >
      <div
        style={{
          width: badgeSize,
          height: badgeSize,
          borderRadius: Math.round(size * 0.18),
          background: "radial-gradient(circle at top, #dfc466 0%, #b88d15 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: accentGlow,
          border: `${Math.max(4, Math.round(size * 0.012))}px solid rgba(255, 245, 214, 0.25)`,
          flexDirection: "column",
          gap: Math.round(size * 0.02),
        }}
      >
        <div style={{ fontSize: titleSize, fontWeight: 700, letterSpacing: "0.12em" }}>AS</div>
        <div style={{ fontSize: subtitleSize, letterSpacing: "0.18em", textTransform: "uppercase" }}>Live</div>
      </div>
    </div>
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> }
) {
  const { size } = await context.params;
  const numericSize = Number(size);

  if (!SUPPORTED_SIZES.has(numericSize)) {
    return new Response("Unsupported icon size", { status: 404 });
  }

  return new ImageResponse(createIconMarkup(numericSize), {
    width: numericSize,
    height: numericSize,
  });
}
