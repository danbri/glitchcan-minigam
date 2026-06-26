// sw.js — offline robustness + caching for the edot suite (scope: this directory).
//
// Two strategies, by asset kind:
//   • IMMUTABLE heavy assets (vendored libs, *.wasm, third_party) → CACHE-FIRST:
//     served instantly from cache on repeat loads with no network round-trip,
//     fetched + cached on first miss. These rarely change, so the round-trip is
//     pure waste — this is the perf win.
//   • Everything else (app code, content) → NETWORK-FIRST with cache fallback:
//     fresh when online, resilient when offline; navigations fall back to the
//     app shell.
// Runtime-caches every successful same-origin GET either way.

const CACHE = 'edot-v2';
const CORE = ['./', './index.html', './css/edot-tokens.css'];

// Big, content-stable assets where a network round-trip on every load is waste.
const IMMUTABLE = /\.wasm$|\/vendor\/|\/third_party\/|ink-full|sql-wasm|three\.module/i;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
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
  if (url.origin !== self.location.origin) return; // leave cross-origin (tiles, APIs) to the network

  // Cache-first for immutable heavy assets: instant on repeat, fetch+cache on miss.
  if (IMMUTABLE.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      }).catch(() => Response.error())),
    );
    return;
  }

  // Network-first for everything else (fresh online, resilient offline).
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
