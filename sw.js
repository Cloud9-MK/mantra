// 七曜マントラ — Service Worker
// Cache-first strategy for offline support.
// Bump CACHE_VERSION whenever you push new assets to invalidate old caches.

const CACHE_VERSION = 'v3-2026-05-29';
const CACHE_NAME = `mantra-${CACHE_VERSION}`;

// Files to pre-cache when the SW installs.
// Relative paths so it works under https://<user>.github.io/<repo>/
const PRECACHE = [
  './',
  './index.html',
  './agastya.jpg',
  './bhara-kumbha.jpg',
];

self.addEventListener('install', (event) => {
  // Activate this SW as soon as it's installed (don't wait for old tabs to close)
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use { cache: 'reload' } to bypass HTTP cache during pre-cache.
      // Best-effort: if an asset (e.g. an optional image) isn't there, don't fail install.
      return Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches from previous versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('mantra-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GET. Don't try to cache POSTs / cross-origin Drive thumbnails.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Skip cross-origin requests (e.g. Google Drive thumbnail fallback images).
  // They go straight to the network; if offline, the image just won't load.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Cache-first: serve cached version immediately.
        // In the background, fetch a fresh copy to update the cache for next time.
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, res));
            }
          })
          .catch(() => {});
        return cached;
      }
      // Not cached → go to network, and store the response if successful.
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // Offline and not in cache → for navigation requests, fall back to index.
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          // Otherwise return a basic offline error response
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
