const CACHE_NAME = "apologia-sancta-shell-v2";
const APP_SHELL = [
  "/",
  "/mobile",
  "/library",
  "/manifest.webmanifest",
  "/offline.html",
  "/app-icons/icon-192.png",
  "/app-icons/icon-512.png",
  "/app-icons/apple-touch-icon-180.png",
];
const API_PREFIXES = ["/events", "/state", "/answer", "/register", "/admin", "/topics", "/rooms", "/leaderboard"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const acceptsSse = request.headers.get("accept")?.includes("text/event-stream");
  const isApiRequest = API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  const isCrossOrigin = url.origin !== self.location.origin;
  const isStaticAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/app-icons/");

  if (acceptsSse || isApiRequest || isCrossOrigin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match("/offline.html"));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if ((isStaticAsset || request.destination === "style" || request.destination === "script" || request.destination === "image") && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }

        return networkResponse;
      });
    })
  );
});