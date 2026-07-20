// 七曜マントラ — Service Worker
// Cache-first strategy for offline support (mp3, images, HTML).
// Videos (.mp4) bypass the cache to allow iOS Safari Range/seek requests.
// Bump CACHE_VERSION whenever you push new assets to invalidate old caches.

const CACHE_VERSION = 'v7-2026-07-21';
const CACHE_NAME = `mantra-${CACHE_VERSION}`;

// Files to pre-cache when the SW installs.
// NOTE: .mp4 files are intentionally EXCLUDED from pre-cache. iOS Safari
// requests videos via HTTP Range headers to seek within them, and a
// generic Response object stored in the Cache API cannot serve partial-content
// (byte-range) responses. Trying to cache videos breaks seek/rewind on iOS.
// Videos are streamed directly from the network instead (see fetch handler).
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
  // Video poster thumbnails (small, cache-friendly)
  './bhara-video-1-poster.jpg',
  './bhara-video-2-poster.jpg',
  './bhara-video-3-poster.jpg',
];

self.addEventListener('install', (event) => {
  // Activate this SW as soon as it's installed
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // { cache: 'reload' } bypasses HTTP cache during pre-cache.
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
  // Skip cross-origin requests (YouTube iframe, Drive fallback thumbnails, etc.)
  if (url.origin !== self.location.origin) return;
  // Skip .mp4 videos entirely so iOS Safari can use its native Range/seek
  // handling; caching a partial response would break media playback.
  if (url.pathname.endsWith('.mp4')) return;
  // Also skip explicit range requests as a safety net for any range-based asset.
  if (req.headers.get('range')) return;

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
