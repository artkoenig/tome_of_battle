const CACHE_NAME = 'tome-of-battle-cache-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Don't cache data files that change independently of app builds
  if (url.pathname.includes('rules-index.json')) return;

  // Catalog data (the catpkg.json index plus individual .cat/.gst files) is fetched
  // at runtime from the fork over raw.githubusercontent.com. It must always hit the
  // network so the revision comparison ("higher wins", see ADR 0014 / ADR 0020) sees
  // the real current server state; a cached copy would silently serve a stale
  // revision to the import screen and to manual reimports. Already-imported systems
  // live entirely in IndexedDB and stay usable without a service-worker cache.
  if (url.hostname.includes('raw.githubusercontent.com')) return;

  // Cache static assets and fonts
  const shouldCache =
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (shouldCache) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            // Cache successful responses
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            // Silent catch for network connectivity issues
            return null;
          });

          // Return cached response immediately if we have it, otherwise wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});

// Skip waiting when message is received
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
