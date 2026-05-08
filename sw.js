// Jolly Space Cow — Service Worker
// Caches the site for offline use and serves a fun offline page when disconnected

const CACHE_NAME = 'jsc-v18'; // Version 18: Senior-grade optimized moo system

const PRECACHE_URLS = [
  './',
  './index.html',
  './videos.html',
  './gallery.html',
  './games.html',
  './about.html',
  './offline.html',
  
  // Styles
  './assets/css/style.css',
  './assets/css/components.css',
  './assets/css/hero.css',
  './assets/css/videos.css',
  './assets/css/games.css',
  './assets/css/gallery.css',
  
  // Scripts
  './assets/js/app.js',
  './assets/js/cursor.js',
  './assets/js/voronoi.js',
  './assets/js/space.js',
  './assets/js/videos.js',
  './assets/js/games.js',
  './assets/js/gallery.js',
  './assets/js/offline.js',
  
  // Public assets
  './public/favicon.ico',
  './public/favicon-16x16.png',
  './public/favicon-32x32.png',
  './public/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
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

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        if (request.destination === 'image') return new Response('', { status: 404 });
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
