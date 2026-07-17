const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const acceptanceDatabaseName = /^[a-z0-9][a-z0-9_-]*_acceptance$/i;

export function assertDisposableDatabaseUrl(rawUrl: string | undefined): asserts rawUrl is string {
  if (!rawUrl) {
    throw new Error(
      "EDITORIAL_ACCEPTANCE_DATABASE_URL is required. Point it to a disposable local database whose name ends in _acceptance."
    );
  }

  const url = new URL(rawUrl);
  if (!["postgres:", "postgresql:", "mysql:"].includes(url.protocol)) {
    throw new Error("Editorial database acceptance supports only PostgreSQL or MySQL URLs.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!loopbackHosts.has(hostname)) {
    throw new Error("Editorial database acceptance refuses non-loopback database hosts.");
  }
  if (url.search || url.hash) {
    throw new Error("Editorial database acceptance refuses connection-string query parameters and fragments.");
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!acceptanceDatabaseName.test(databaseName)) {
    throw new Error("Editorial database acceptance requires one safe database name ending in _acceptance.");
  }
}
