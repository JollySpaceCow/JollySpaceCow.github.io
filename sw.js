// Jolly Space Cow — Service Worker
// Caches the site for offline use and serves a fun offline page when disconnected

const CACHE_NAME = 'jsc-v1';

// Core pages and assets to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './videos.html',
  './gallery.html',
  './games.html',
  './about.html',
  './offline.html',
  './assets/css/style.css',
  './assets/js/cursor.js',
  './assets/js/voronoi.js',
  './public/favicon.ico',
  './public/favicon-16x16.png',
  './public/favicon-32x32.png',
  './public/apple-touch-icon.png',
];

// Install — pre-cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first for navigations, cache-first for assets
self.addEventListener('fetch', event => {
  const { request } = event;

  // HTML page navigations — try network first, fall back to cache, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful navigation responses for later offline use
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match('./offline.html'))
        )
    );
    return;
  }

  // Static assets — cache-first (faster), fall back to network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Only cache same-origin successful responses
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // For images that fail offline, return nothing gracefully
        if (request.destination === 'image') {
          return new Response('', { status: 404 });
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
