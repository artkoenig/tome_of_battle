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
