// Service Worker for offline PWA caching
const CACHE_NAME = 'emma-vrm-tutor-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './vrm-viewer.js',
  './speech-service.js',
  './gemini-service.js',
  './curriculum.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network first with cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
