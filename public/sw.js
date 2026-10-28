/**
 * IWACU RWANDA — Service Worker
 * Caches Gasabo boundaries + app shell for offline confidence calculation.
 * Offline mode is READ-ONLY.
 */

const CACHE_VERSION = "iwacu-v1";
const BOUNDARIES_CACHE = "iwacu-boundaries-v1";
const SHELL_CACHE = "iwacu-shell-v1";

const PRECACHE_URLS = [
  "/",
  "/offline/gasabo-boundaries.geojson",
  "/manifest.json",
];

// ---------------------------------------------------------------------------
// Install – precache shell + boundaries
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(PRECACHE_URLS.filter((u) => u !== "/offline/gasabo-boundaries.geojson"));

      // Boundaries may be large; cache separately and tolerate failure
      try {
        const boundaries = await caches.open(BOUNDARIES_CACHE);
        await boundaries.add("/offline/gasabo-boundaries.geojson");
      } catch (err) {
        console.warn("[SW] Failed to precache boundaries:", err);
      }

      self.skipWaiting();
    })()
  );
});

// ---------------------------------------------------------------------------
// Activate – clean old caches
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              k.startsWith("iwacu-") &&
              k !== SHELL_CACHE &&
              k !== BOUNDARIES_CACHE
          )
          .map((k) => caches.delete(k))
      );
      self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------------------------
// Fetch – network-first for API, cache-first for static + boundaries
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // API routes: network-only (never cache personalised responses)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({
              status: "error",
              code: "NETWORK_ERROR",
              message_kiny:
                "Uri offline. Serivisi ntabwo ihari. Gerageza nyuma.",
              message_eng: "You are offline. Service unavailable.",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          )
      )
    );
    return;
  }

  // Boundaries GeoJSON: cache-first
  if (url.pathname === "/offline/gasabo-boundaries.geojson") {
    event.respondWith(cacheFirst(request, BOUNDARIES_CACHE));
    return;
  }

  // App shell & static assets: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("{}", {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}
