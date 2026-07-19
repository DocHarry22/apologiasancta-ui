const CACHE_NAME = "apologia-sancta-shell-v6";
const LEARNING_CACHE = "apologia-sancta-learning-v1";
const PROGRESS_QUEUE = "apologia-progress-queue-v1";
const APP_SHELL = [
  "/learn",
  "/practice",
  "/library",
  "/manifest.webmanifest",
  "/offline.html",
  "/app-icons/icon-192.png",
  "/app-icons/icon-512.png",
  "/app-icons/apple-touch-icon-180.png",
];
const API_PREFIXES = ["/api/", "/events", "/state", "/answer", "/register", "/admin", "/topics", "/rooms", "/leaderboard"];
const LEARNING_GET = /^\/api\/v1\/learning\/(programmes|subjects|groups|lessons|practice|search)(\/|\?|$)/;
const SAFE_PROGRESS_EVENT = /^\/api\/v1\/learning\/lessons\/[^/]+\/progress\/?$/;

function openProgressQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PROGRESS_QUEUE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("requests")) database.createObjectStore("requests", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queueProgressRequest(request) {
  const database = await openProgressQueue();
  const record = {
    id: crypto.randomUUID(),
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    body: await request.clone().text(),
    createdAt: Date.now(),
  };
  await new Promise((resolve, reject) => {
    const transaction = database.transaction("requests", "readwrite");
    transaction.objectStore("requests").put(record);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  if (self.registration.sync) self.registration.sync.register("sync-learning-progress").catch(() => undefined);
  return record.id;
}

async function flushProgressQueue() {
  const database = await openProgressQueue();
  const records = await new Promise((resolve, reject) => {
    const transaction = database.transaction("requests", "readonly");
    const request = transaction.objectStore("requests").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  for (const record of records) {
    try {
      const response = await fetch(record.url, { method: record.method, headers: record.headers, body: record.body, credentials: "include" });
      if (!response.ok && ![400, 401, 403, 409].includes(response.status)) continue;
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("requests", "readwrite");
        transaction.objectStore("requests").delete(record.id);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      return;
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => ![CACHE_NAME, LEARNING_CACHE].includes(key))
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  const requestUrl = new URL(request.url);

  if (request.method !== "GET") {
    if (request.method === "PUT" && requestUrl.origin === self.location.origin && SAFE_PROGRESS_EVENT.test(requestUrl.pathname)) {
      event.respondWith(fetch(request.clone()).catch(async () => {
        const queueId = await queueProgressRequest(request);
        return new Response(JSON.stringify({ data: { queued: true, official: false, queueId } }), {
          status: 202,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }));
    }
    return;
  }

  const url = requestUrl;
  const acceptsSse = request.headers.get("accept")?.includes("text/event-stream");
  const isApiRequest = API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  const isCrossOrigin = url.origin !== self.location.origin;
  const isStaticAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/app-icons/");
  const isNextDataRequest = request.headers.get("rsc") === "1"
    || request.headers.has("next-router-prefetch")
    || url.searchParams.has("_rsc");

  if (!isCrossOrigin && LEARNING_GET.test(`${url.pathname}${url.search}`)) {
    event.respondWith((async () => {
      const cache = await caches.open(LEARNING_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && !response.headers.get("cache-control")?.includes("private")) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || new Response(JSON.stringify({ error: "Published learning content is unavailable offline." }), { status: 503, headers: { "content-type": "application/json" } });
      }
    })());
    return;
  }

  if (acceptsSse || isApiRequest || isCrossOrigin || isNextDataRequest) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok && url.pathname.startsWith("/learn")) {
          const cache = await caches.open(LEARNING_CACHE);
          await cache.put(request, response.clone());
        }
        void flushProgressQueue();
        return response;
      }).catch(async () => {
        const learningCache = await caches.open(LEARNING_CACHE);
        const shellCache = await caches.open(CACHE_NAME);
        return (await learningCache.match(request)) || (await shellCache.match(request)) || (await shellCache.match("/offline.html"));
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
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)).catch(() => undefined);
        }

        return networkResponse;
      });
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-learning-progress") event.waitUntil(flushProgressQueue());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "FLUSH_LEARNING_PROGRESS") event.waitUntil(flushProgressQueue());
});
