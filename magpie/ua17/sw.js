// sw.js — offline caching for the UA17 flight scene (scope: this directory).
//
// STRATEGY (revised): the previous version was cache-first for the app code,
// which meant returning visitors could be stuck on a STALE build even after a
// new deploy (you'd never see the latest fixes without clearing data). Now:
//   • App code (HTML/CSS/JS) and data JSON  → NETWORK-FIRST: always fresh when
//     online, fall back to cache when offline. Fixes the stale-version problem.
//   • The big vendored three.js build         → CACHE-FIRST: it's large and
//     effectively immutable, so serve instantly and skip the round-trip.
// Everything is still precached on install, so the whole experience works
// fully offline (airplane mode, or from a zip) after one online visit.

const CACHE = 'ua17-v11';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './css/ua17.css',
  './js/ua17-app.js',
  './js/ua17-scene.js',
  './js/ua17-route.js',
  './js/ua17-aircraft.js',
  './js/ua17-airport.js',
  './js/ua17-sky.js',
  './js/ua17-terrain.js',
  './js/ua17-clouds.js',
  './js/ua17-buildings.js',
  './js/ua17-landmarks.js',
  './js/ua17-flights.js',
  './js/ua17-particles.js',
  './js/ua17-audio.js',
  './vendor/three.module.min.js',
  './data/weather.json',
  './data/flight-info.json',
  './data/buildings-london.json',
  './data/buildings-nyc.json',
  './data/flights-snapshot.json',
  './data/elevation-london.json',
  './data/elevation-nyc.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-maskable-512.png',
];

// Large, effectively-immutable assets served cache-first for speed.
const CACHE_FIRST = /\/vendor\/|\.png$|\.svg$/i;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll fails atomically if any single file 404s; add individually so a
      // missing optional asset can't block the whole install.
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Let the page trigger an immediate takeover after an update.
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  // Cache-first for the big immutable assets.
  if (CACHE_FIRST.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })),
    );
    return;
  }

  // Network-first for app code + data: fresh online, cached offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached
        || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
