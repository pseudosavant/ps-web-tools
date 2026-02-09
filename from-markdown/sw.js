const SW_VERSION = 'from-markdown-sw-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => key !== SW_VERSION)
                .map((key) => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

// Intentionally no fetch handler to avoid caching old resources.
