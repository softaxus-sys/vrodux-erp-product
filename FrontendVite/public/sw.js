/*
 * App-shell service worker — lets a browser till reload the POS with no internet.
 *
 * Scope is deliberately narrow:
 *   - Page navigations: network first, cached shell as the fallback (so a new deploy is picked up
 *     whenever the network is there).
 *   - Same-origin static files (/assets/*, icons): cache first — Vite fingerprints them, so a cached
 *     file can never be stale.
 *   - Everything else, including /api, is never touched. Offline POS data lives in IndexedDB.
 *
 * A chunk is cached the first time it loads, so a till must open the POS once while online.
 */

const SHELL_CACHE  = "vrodux-shell-v1";
const ASSET_CACHE  = "vrodux-assets-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.add("/")).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/hubs/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put("/", res.clone()));
          return res;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || /\.(svg|png|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
      )
    );
  }
});
