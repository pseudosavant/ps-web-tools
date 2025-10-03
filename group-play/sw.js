// Simple service worker for offline shell (Milestone 1)
const CACHE_NAME = 'group-play-m1-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);
  if (url.origin === location.origin) {
    evt.respondWith(
      caches.match(evt.request).then(r => r || fetch(evt.request))
    );
  }
});
