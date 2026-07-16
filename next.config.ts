import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));

/**
 * Extract just the origin (scheme + host + port) from a URL string.
 *
 * Only NEXT_PUBLIC_ENGINE_URL is used here — it is the public-facing engine
 * origin that the browser needs for SSE connections and REST polling.
 * ENGINE_INTERNAL_URL is server-side only and must NEVER appear in any
 * browser-facing header.
 */
function safeOrigin(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

const engineOrigin = safeOrigin(process.env.NEXT_PUBLIC_ENGINE_URL ?? "");

function resolveBuildRevision(): string {
  const supplied = [
    process.env.GIT_COMMIT_SHA,
    process.env.COMMIT_REF,
    process.env.HOSTINGER_GIT_COMMIT,
  ].find((value) => value?.trim());
  if (supplied) return supplied.trim();
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: workspaceRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  trailingSlash: true,
  env: {
    APP_BUILD_REVISION: resolveBuildRevision(),
  },
  turbopack: {
    root: workspaceRoot,
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";

    // connect-src: allow same-origin and the public engine origin.
    // The engine origin is needed for SSE (/events), REST polling (/state),
    // and any direct public API calls from the browser.
    // ENGINE_INTERNAL_URL is deliberately excluded: server-side only.
    const connectSrc = ["'self'", engineOrigin].filter(Boolean).join(" ");

    // Content Security Policy.
    //
    // unsafe-inline in script-src and style-src: required by Next.js which
    // injects inline <script> blocks for hydration bootstrapping and inline
    // <style> tags. This can be removed in a future phase by adopting
    // nonce-based CSP via Next.js middleware.
    //
    // unsafe-eval is intentionally omitted from production script-src.
    // If a dependency requires it, add it with an explicit comment.
    const cspDirectives = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      `connect-src ${connectSrc}`,
      // unsafe-inline required for Next.js hydration scripts and Tailwind style tags.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // https: allows any HTTPS-served image (e.g. remote topic thumbnails).
      "img-src 'self' data: blob: https:",
      // data: allows base64-encoded fonts embedded in CSS.
      "font-src 'self' data:",
      // manifest-src restricts PWA manifest loading to same origin.
      "manifest-src 'self'",
      // blob: allows the service worker to be registered from a blob URL if needed.
      "worker-src 'self' blob:",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          // Prevent MIME-type sniffing.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Prevent embedding in frames/iframes.
          { key: "X-Frame-Options", value: "DENY" },
          // Limit referrer information to same-origin-only on cross-origin requests.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser features not used by this app.
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "payment=()",
              "usb=()",
              "interest-cohort=()",
            ].join(", "),
          },
          // HSTS: production only (would break local HTTP dev if applied everywhere).
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
                // CSP: production only. Dev uses looser defaults so hot-reload
                // and React DevTools are not broken by inline eval restrictions.
                {
                  key: "Content-Security-Policy",
                  value: cspDirectives,
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
