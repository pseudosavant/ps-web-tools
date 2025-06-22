const CACHE_NAME = 'frame-recall-v1';
const urlsToCache = [
    '/recall/',
    '/recall/index.html',
    '/recall/styles.css',
    '/recall/app.js',
    '/recall/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
    );
});
