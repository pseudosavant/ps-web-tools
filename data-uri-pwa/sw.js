const CACHE_PREFIX = "data-uri-pwa-";
const CACHE = `${CACHE_PREFIX}v7`;
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./script.js?v=5",
  "./core.js?v=5",
  "./style.css?v=7",
  "./manifest.json?v=7",
  "./favicon.svg",
  "./favicon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  event.respondWith(cacheFirstAndUpdate(event));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (shouldCache(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await cache.match(request)) || (await cache.match("./index.html")) || Response.error();
  }
}

async function cacheFirstAndUpdate(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  const networkUpdate = fetchAndCache(cache, event.request);

  if (cached) {
    event.waitUntil(networkUpdate.catch(() => undefined));
    return cached;
  }

  try {
    return await networkUpdate;
  } catch (error) {
    return Response.error();
  }
}

async function fetchAndCache(cache, request) {
  const response = await fetch(request);
  if (shouldCache(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

function shouldCache(response) {
  return response && response.ok && response.type === "basic";
}
