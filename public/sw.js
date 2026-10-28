/**
 * IWACU RWANDA — Service Worker (v2)
 * Network-first for all HTML/navigation requests so the app always displays
 * the latest up-to-date UI, with offline cache fallback.
 */

const CACHE_VERSION = "iwacu-v2-nocache-html";
const SHELL_CACHE = `iwacu-shell-${CACHE_VERSION}`;
const BOUNDARIES_CACHE = `iwacu-boundaries-${CACHE_VERSION}`;

// ---------------------------------------------------------------------------
// Install – Skip waiting immediately
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate – Clean all old caches immediately
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== BOUNDARIES_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------------------------
// Fetch – Network-first for pages and API
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // 1. Navigation / HTML pages: MUST ALWAYS BE NETWORK-FIRST
  if (
    request.mode === "navigate" ||
    request.destination === "document" ||
    url.pathname === "/"
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            "<!DOCTYPE html><html><body><h1>Offline</h1><p>Nta murongo wa interineti ufite.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 2. API routes: network-only
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({
              status: "error",
              code: "NETWORK_ERROR",
              message_kiny: "Uri offline. Serivisi ntabwo ihari. Gerageza nyuma.",
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

  // 3. Static assets: Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || new Response("", { status: 404 });
      })
  );
});
