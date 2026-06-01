// 七曜マントラ — Service Worker
// Cache-first strategy for offline support.
// Bump CACHE_VERSION whenever you push new assets to invalidate old caches.

const CACHE_VERSION = 'v5-2026-06-02b';
const CACHE_NAME = `mantra-${CACHE_VERSION}`;

// Files to pre-cache when the SW installs.
// Relative paths so it works under https://<user>.github.io/<repo>/
const PRECACHE = [
  './',
  './index.html',
  './agastya.jpg',
  './bhara-kumbha.jpg',
  // Per-weekday mantra recordings (Bhara Kumbha Guru Muni / acharya chanting)
  './mantra-sun.mp3',
  './mantra-moon.mp3',
  './mantra-mars.mp3',
  './mantra-mercury.mp3',
  './mantra-jupiter.mp3',
  './mantra-venus.mp3',
  './mantra-saturn.mp3',
  './mantra-rahu.mp3',
  './mantra-ketu.mp3',
  // Karma-dissolving mantras (Tuesday: Murugan, Thursday: Agastya)
  './mantra-murugan.mp3',
  './mantra-agastya.mp3',
];

self.addEventListener('install', (event) => {
  // Activate this SW as soon as it's installed (don't wait for old tabs to close)
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use { cache: 'reload' } to bypass HTTP cache during pre-cache.
      // Best-effort: if an asset isn't there, don't fail install.
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
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Skip cross-origin requests (e.g. Google Drive thumbnail fallback images).
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Cache-first: serve cached version immediately, fetch fresh in background.
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, res));
            }
          })
          .catch(() => {});
        return cached;
      }
      // Not cached → go to network and store the response if successful.
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
