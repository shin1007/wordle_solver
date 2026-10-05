const CACHE_NAME = 'wordle-solver-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/words.js',
  '/opening.js',
  '/book.js',
  '/solver.js',
  '/solver-worker.js',
  '/manifest.json',
  '/icons/192.png',
  '/icons/512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});