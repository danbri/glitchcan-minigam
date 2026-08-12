/**
 * sw.js — offline support.
 *
 * A family goes to a park or a hill to watch. The signal there is often
 * bad. Everything this guide needs is a static file and a calculation
 * that runs on the device, so the whole app can work with no network at
 * all. That is the point of this file.
 *
 * Strategy: cache-first for the app shell, because none of these files
 * change during an eclipse. Bump CACHE_NAME to ship an update.
 */

const CACHE_NAME = 'eclipse-watch-v1';

const SHELL = [
  './',
  './index.html',
  './eclipse.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg',
  './vendor/astronomy.browser.min.js',
  './js/eclipse-app.js',
  './js/eclipse-calc.js',
  './js/eclipse-sky.js',
  './js/eclipse-compass.js',
  './js/eclipse-explain.js',
  './js/eclipse-senses.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          // Put new same-origin files in the cache as they are used.
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
