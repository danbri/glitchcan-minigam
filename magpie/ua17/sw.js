// sw.js — full offline caching for the UA17 flight scene (scope: this directory).
//
// Everything the app needs (HTML/CSS/JS modules, the vendored three.js build,
// and every fetched data snapshot) is explicitly precached on install, so a
// single online visit is enough for the whole experience to work forever
// after in airplane mode — or from a zip copied straight onto a device with
// no network at all. See README.md for the zip-and-go instructions.
//
// Strategy: cache-first for everything precached (instant, no round-trip);
// network-first with cache fallback for anything unexpected, so a live
// update during development is still picked up when online.

const CACHE = 'ua17-v3';
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
  './js/ua17-clouds.js',
  './js/ua17-buildings.js',
  './js/ua17-flights.js',
  './js/ua17-particles.js',
  './js/ua17-audio.js',
  './vendor/three.module.min.js',
  './data/weather.json',
  './data/flight-info.json',
  './data/buildings-london.json',
  './data/buildings-nyc.json',
  './data/flights-snapshot.json',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    }),
  );
});
