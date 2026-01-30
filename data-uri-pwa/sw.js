const CACHE = "cache-and-update";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./icon.svg",
  "./script.js",
  "./style.css",
  "./manifest.json"
];

self.addEventListener("install", function(e) {
  console.info("The service worker is being installed.");
  e.waitUntil(precache());
});

self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(e.request);
      if (cached) {
        e.waitUntil(update(cache, e.request));
        return cached;
      }
      return fetchAndCache(cache, e.request);
    })()
  );
});

function precache() {
  return caches.open(CACHE).then(function(cache) {
    return cache.addAll(PRECACHE_URLS);
  });
}

function fetchAndCache(cache, request) {
  return fetch(request)
    .then(function(response) {
      if (shouldCache(response)) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(function() {
      return cache.match(request).then(function(matching) {
        return matching || Response.error();
      });
    });
}

function update(cache, request) {
  return fetch(request)
    .then(function(response) {
      if (shouldCache(response)) {
        return cache.put(request, response.clone());
      }
      return undefined;
    })
    .catch(function() {
      return undefined;
    });
}

function shouldCache(response) {
  return response && response.ok && (response.type === "basic" || response.type === "cors");
}
