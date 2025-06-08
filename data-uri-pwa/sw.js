const CACHE = "cache-and-update";

self.addEventListener("install", function(e) {
  console.info("The service worker is being installed.");
  e.waitUntil(precache());
});

self.addEventListener("fetch", function(e) {
  console.info("The service worker is serving the asset.");
  e.respondWith(fromCache(e.request));
  e.waitUntil(update(e.request));
});

function precache() {
  return caches.open(CACHE).then(function(cache) {
    return cache.addAll([
      '/',
      '/icon.svg',
      'script.js',
      '/style.css',
      '/index.html'
    ]);
  });
}

function fromCache(request) {
  return caches.open(CACHE).then(function(cache) {
    return cache.match(request).then(function(matching) {
      return matching || Promise.reject("no-match");
    });
  });
}

function update(request) {
  return caches.open(CACHE).then(function(cache) {
    return fetch(request).then(function(response) {
      return cache.put(request, response);
    });
  });
}
