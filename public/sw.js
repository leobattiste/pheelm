/*
 * Pheelm's service worker: makes the installed app quick and usable offline.
 * - The site's own scripts, styles and fonts: from the cache first (their names change when they do).
 * - Posters and photos: from the cache, refreshed in the background.
 * - Pages: from the network, falling back to the last copy, then to the offline page.
 * Signed-in pages, admin, auth and API calls are never cached.
 */
const VERSION = "pheelm-v3";
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

/** Keep a cache to its newest `max` entries. Never throws: trimming is housekeeping. */
async function trim(name, max) {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
  } catch {}
}

/** Store one response, trimming now and then rather than on every image. */
async function save(cache, request, response) {
  try {
    await cache.put(request, response);
    if (Math.random() < 0.05) await trim(IMAGES, 400);
  } catch {
    // A full cache must not stop the image being shown, so drop what we have and carry on.
    await trim(IMAGES, 100);
  }
}

/** Fetch a cached image again in the background; a failure leaves the cached copy in place. */
async function refresh(cache, request) {
  try {
    const res = await fetch(request);
    if (res.ok || res.type === "opaque") await save(cache, request, res);
  } catch {}
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // The site's own build files and fonts: cache first, and the network whenever the cache can't help.
  if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith((async () => {
      const hit = await caches.match(request).catch(() => undefined);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) event.waitUntil(caches.open(STATIC).then((c) => c.put(request, res.clone())).catch(() => {}));
      return res;
    })());
    return;
  }

  // Posters, stills and portraits: cached, refreshed in the background. Every step falls back to
  // the plain network request, so a full cache or a failed write can never blank out an image.
  if (request.destination === "image" && (url.hostname === "image.tmdb.org" || url.pathname.startsWith("/_next/image"))) {
    event.respondWith((async () => {
      let cache = null;
      try { cache = await caches.open(IMAGES); } catch { return fetch(request); }
      const hit = await cache.match(request).catch(() => undefined);
      if (hit) {
        event.waitUntil(refresh(cache, request));
        return hit;
      }
      const res = await fetch(request);
      if (res.ok || res.type === "opaque") event.waitUntil(save(cache, request, res.clone()));
      return res;
    })());
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
          if (res.ok && res.type === "basic" && !res.redirected && !/private|no-store/i.test(res.headers.get("cache-control") || "")) event.waitUntil(caches.open(PAGES).then((c) => c.put(request, res.clone())).then(() => trim(PAGES, 60)).catch(() => {}));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE))),
    );
  }
});
