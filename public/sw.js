// Service worker minimal : rend l'appli installable et met en cache les images
// (photos des candidates, icônes). Les pages et l'API passent toujours par le réseau.
const CACHE = 'mf-static-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (!url.pathname.startsWith('/img/') && !url.pathname.startsWith('/icons/')) return;
    event.respondWith(
        caches.open(CACHE).then(async (cache) => {
            const hit = await cache.match(event.request);
            if (hit) return hit;
            const response = await fetch(event.request);
            if (response.ok) cache.put(event.request, response.clone());
            return response;
        })
    );
});
