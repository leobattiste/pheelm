/*
 * Pheelm's service worker: makes the installed app quick and usable offline.
 * - The site's own scripts, styles and fonts: from the cache first (their names change when they do).
 * - Posters and photos: from the cache, refreshed in the background.
 * - Pages: from the network, falling back to the last copy, then to the offline page.
 * Signed-in pages, admin, auth and API calls are never cached.
 */
const VERSION = "pheelm-v2";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const IMAGES = `${VERSION}-images`;
const OFFLINE = "/offline";
// Cache only known public information pages. Member pages and the gated catalog
// must never be restored for another account from an offline HTML cache.
const PUBLIC_PAGE = /^\/(about|partnerships|legal|privacy|terms|donate|offline)\/?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pheelm-") && !k.startsWith(`${VERSION}-`)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Keep a cache to its newest `max` entries. */
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // The site's own build files and fonts: cache first.
  if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) caches.open(STATIC).then((c) => c.put(request, res.clone()));
        return res;
      })),
    );
    return;
  }

  // Posters, stills and portraits: cached, refreshed in the background.
  if (request.destination === "image" && (url.hostname === "image.tmdb.org" || url.pathname.startsWith("/_next/image"))) {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const hit = await cache.match(request);
        const fresh = fetch(request).then((res) => {
          if (res.ok || res.type === "opaque") cache.put(request, res.clone()).then(() => trim(IMAGES, 400));
          return res;
        }).catch(() => hit);
        return hit || fresh;
      }),
    );
    return;
  }

  // Pages: network first, then the last saved copy, then the offline page.
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    if (!PUBLIC_PAGE.test(url.pathname) || url.search) {
      event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
      return;
    }
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && res.type === "basic" && !res.redirected && !/private|no-store/i.test(res.headers.get("cache-control") || "")) caches.open(PAGES).then((c) => c.put(request, res.clone()).then(() => trim(PAGES, 60)));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE))),
    );
  }
});
