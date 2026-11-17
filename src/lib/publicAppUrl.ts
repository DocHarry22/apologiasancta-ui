export const DEFAULT_PUBLIC_APP_ORIGIN = "https://sandybrown-bear-488955.hostingersite.com";

const LOCAL_DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function safeOrigin(value: string | undefined, allowLocalHttp: boolean): string | null {
  const configured = value?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return url.origin;
    if (allowLocalHttp && url.protocol === "http:" && LOCAL_DEVELOPMENT_HOSTS.has(url.hostname)) {
      return url.origin;
    }
  } catch {
    // Invalid public configuration falls back to the known production origin.
  }

  return null;
}

export function getPublicAppOrigin(
  environment: NodeJS.ProcessEnv = process.env,
  requestOrigin?: string,
): string {
  const development = environment.NODE_ENV !== "production";
  const configured = safeOrigin(environment.NEXT_PUBLIC_APP_URL, development);
  if (configured) return configured;

  if (development) {
    const request = safeOrigin(requestOrigin, true);
    if (request) return request;
  }

  return DEFAULT_PUBLIC_APP_ORIGIN;
}

export function getPublicAppUrl(
  pathname = "/",
  environment: NodeJS.ProcessEnv = process.env,
  requestOrigin?: string,
): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, `${getPublicAppOrigin(environment, requestOrigin)}/`).toString();
}
