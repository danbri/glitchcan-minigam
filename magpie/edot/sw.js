// sw.js — offline robustness for the edot suite (scope: this directory).
//
// Strategy: network-first with a cache fallback, plus runtime caching of every
// successful same-origin GET. Online users always get fresh files; on a flaky or
// absent network the last-seen version is served, and navigations fall back to
// the app shell. No staleness when online, real resilience when not.

const CACHE = 'edot-v1';
const CORE = ['./', './index.html', './css/edot-tokens.css'];

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
