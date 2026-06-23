// test-backup.mjs — headless tests for the Tier-1 encrypted backup feature.
// Same style as data/test-data.mjs: tiny static server at the repo root, real
// Chromium, ✅/❌, non-zero exit on failure. All network goes through a MOCKED
// fetch — no real credentials, no real endpoints are contacted.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    const buf = await readFile(path.join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/backup/backup.html`);
  await page.waitForFunction(() => !!window.__backup && !!window.__backup.component());
  ok('page + __backup hook ready', true);

  // Install a shared in-page mock fetch over an in-memory blob store. Each
  // adapter speaks a different protocol; the mock answers all four.
  await page.evaluate(() => {
    const store = new Map();                 // path -> Uint8Array (ciphertext)
    window.__calls = [];
    const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
    const unb64 = (s) => { const bin = atob(s); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    const bin = (u8, status = 200) => new Response((status === 204 || status === 304) ? null : u8, { status, headers: { 'content-type': 'application/octet-stream' } });

    window.__mockFetch = async (url, opts = {}) => {
      url = String(url); const m = (opts.method || 'GET').toUpperCase();
      window.__calls.push({ method: m, url });
      const body = opts.body;
      const u = new URL(url, 'http://mock.local');

      // --- GitHub Contents API ---
      if (url.startsWith('https://api.github.com')) {
        const cm = /\/contents\/(.+?)(\?|$)/.exec(url);
        const cpath = cm ? decodeURIComponent(cm[1]) : '';
        if (/\/contents\//.test(url) && m === 'PUT') {
          const j = JSON.parse(body); store.set('gh:' + cpath, unb64(j.content));
          return json({ content: { sha: 'sha-' + cpath } });
        }
        if (/\/contents\//.test(url) && m === 'GET') {
          // Directory listing (the dir path itself) vs single file.
          if (cpath.endsWith('edot-backups') || !cpath.endsWith('.enc')) {
            const files = [...store.keys()].filter((k) => k.startsWith('gh:' + cpath + '/'))
              .map((k) => ({ type: 'file', name: k.slice(('gh:' + cpath + '/').length), size: store.get(k).length, sha: 'sha' }));
            if (files.length) return json(files);
            // not a dir we know — maybe a missing file
            return store.has('gh:' + cpath) ? json({ encoding: 'base64', content: b64(store.get('gh:' + cpath)), sha: 's' }) : json({ message: 'Not Found' }, 404);
          }
          if (!store.has('gh:' + cpath)) return json({ message: 'Not Found' }, 404);
          return json({ encoding: 'base64', content: b64(store.get('gh:' + cpath)), sha: 's' });
        }
        if (/\/contents\//.test(url) && m === 'DELETE') { store.delete('gh:' + cpath); return json({}); }
        return json({});
      }

      // --- S3 presigned-style: key carried in ?key=, op in ?op= ---
      if (u.searchParams.has('s3key')) {
        const k = 's3:' + u.searchParams.get('s3key');
        if (m === 'PUT') { store.set(k, new Uint8Array(body)); return bin(new Uint8Array(0)); }
        if (m === 'GET') return store.has(k) ? bin(store.get(k)) : bin(new Uint8Array(0), 404);
        if (m === 'DELETE') { store.delete(k); return bin(new Uint8Array(0), 204); }
      }
      if (u.searchParams.get('op') === 'list-s3') {
        const items = [...store.keys()].filter((k) => k.startsWith('s3:edot-backups/'))
          .map((k) => `<Contents><Key>${k.slice(3)}</Key><Size>${store.get(k).length}</Size><LastModified>2026-06-23T00:00:00Z</LastModified></Contents>`).join('');
        return new Response(`<?xml version="1.0"?><ListBucketResult>${items}</ListBucketResult>`, { status: 200 });
      }

      // --- WebDAV ---
      if (u.pathname.startsWith('/dav/')) {
        const k = 'dav:' + u.pathname;
        if (m === 'PUT') { store.set(k, new Uint8Array(body)); return new Response('', { status: 201 }); }
        if (m === 'GET') return store.has(k) ? bin(store.get(k)) : bin(new Uint8Array(0), 404);
        if (m === 'DELETE') { store.delete(k); return new Response(null, { status: 204 }); }
        if (m === 'PROPFIND') {
          const resp = [...store.keys()].filter((k2) => k2.startsWith('dav:/dav/'))
            .map((k2) => { const name = k2.slice('dav:'.length); return `<d:response><d:href>${name}</d:href><d:propstat><d:prop><d:getcontentlength>${store.get(k2).length}</d:getcontentlength><d:getlastmodified>Mon, 23 Jun 2026 00:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response>`; }).join('');
          return new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${resp}</d:multistatus>`, { status: 207 });
        }
      }

      // --- Solid Pod (LDP container) ---
      if (u.pathname.startsWith('/pod/')) {
        const isContainer = u.pathname.endsWith('/');
        const k = 'solid:' + u.pathname;
        if (m === 'PUT') { store.set(k, new Uint8Array(body)); return new Response('', { status: 201 }); }
        if (m === 'GET' && !isContainer) return store.has(k) ? bin(store.get(k)) : bin(new Uint8Array(0), 404);
        if (m === 'GET' && isContainer) {
          const triples = [...store.keys()].filter((k2) => k2.startsWith('solid:' + u.pathname) && k2.endsWith('.enc'))
            .map((k2) => `<${u.origin}${k2.slice('solid:'.length)}>`).map((iri) => `<> ldp:contains ${iri} .`).join('\n');
          return new Response(`@prefix ldp: <http://www.w3.org/ns/ldp#> .\n${triples}`, { status: 200, headers: { 'content-type': 'text/turtle' } });
        }
        if (m === 'DELETE') { store.delete(k); return new Response(null, { status: 204 }); }
      }

      return new Response('unhandled ' + url, { status: 500 });
    };
  });

  // ---- 1. Crypto round-trip / failure modes ----
  const crypto = await page.evaluate(async () => {
    const C = window.__backup.crypto;
    const bytes = new TextEncoder().encode('the quick brown fox 🦊 — secret data');
    const env = await C.encryptSnapshot(bytes, 'correct horse battery staple');
    const back = await C.decryptSnapshot(env, 'correct horse battery staple');
    const same = back.length === bytes.length && back.every((b, i) => b === bytes[i]);

    const header = C.readEnvelopeHeader(env);
    const sha = await C.sha256Hex(bytes);

    let wrongPass = false;
    try { await C.decryptSnapshot(env, 'wrong passphrase'); } catch { wrongPass = true; }

    // Flip one ciphertext byte (well past the header) -> GCM auth must fail.
    const tampered = env.slice();
    tampered[tampered.length - 5] ^= 0x01;
    let tamperFail = false;
    try { await C.decryptSnapshot(tampered, 'correct horse battery staple'); } catch { tamperFail = true; }

    return { same, wrongPass, tamperFail, shaMatch: header.sha256OfPlaintext === sha, iters: header.kdf.iterations, ver: header.v };
  });
  ok('crypto: encrypt→decrypt recovers exact bytes', crypto.same);
  ok('crypto: wrong passphrase fails', crypto.wrongPass);
  ok('crypto: flipped ciphertext byte fails (GCM)', crypto.tamperFail);
  ok('crypto: recorded SHA-256 matches plaintext', crypto.shaMatch);
  ok('crypto: PBKDF2 iterations >= 200k', crypto.iters >= 200000);
  ok('crypto: envelope is versioned (v=1)', crypto.ver === 1);

  // ---- 2. Snapshot: seed IndexedDB, snapshot, wipe, restore ----
  const snap = await page.evaluate(async () => {
    const S = window.__backup.snapshot;
    // Seed a custom DB with an inline-key store + a binary value.
    await new Promise((res, rej) => {
      const r = indexedDB.open('edot-grid', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('cells')) r.result.createObjectStore('cells', { keyPath: 'id' }); };
      r.onsuccess = () => { const db = r.result; const tx = db.transaction('cells', 'readwrite');
        tx.objectStore('cells').put({ id: 'a1', v: 42, blob: new Uint8Array([1, 2, 3, 4]) });
        tx.objectStore('cells').put({ id: 'b2', v: 'hi' });
        tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
      r.onerror = () => rej(r.error);
    });

    const databases = [{ name: 'edot-grid', stores: '*' }];
    const { bytes, manifest } = await S.createSnapshot({ databases });
    const grid = manifest.databases.find((d) => d.db === 'edot-grid');

    // Wipe the store.
    await new Promise((res, rej) => { const r = indexedDB.open('edot-grid', 1); r.onsuccess = () => { const db = r.result; const tx = db.transaction('cells', 'readwrite'); tx.objectStore('cells').clear(); tx.oncomplete = () => { db.close(); res(); }; }; r.onerror = () => rej(r.error); });
    const afterWipe = await new Promise((res) => { const r = indexedDB.open('edot-grid', 1); r.onsuccess = () => { const db = r.result; const tx = db.transaction('cells', 'readonly'); const c = tx.objectStore('cells').count(); c.onsuccess = () => { db.close(); res(c.result); }; }; });

    await S.restoreSnapshot(bytes, { databases });
    const restored = await new Promise((res) => { const r = indexedDB.open('edot-grid', 1); r.onsuccess = () => { const db = r.result; const tx = db.transaction('cells', 'readonly'); const g = tx.objectStore('cells').get('a1'); g.onsuccess = () => { db.close(); res(g.result); }; }; });

    return {
      manifestCount: grid ? grid.stores.find((s) => s.store === 'cells').count : -1,
      afterWipe,
      restoredV: restored && restored.v,
      blobOk: restored && restored.blob instanceof Uint8Array && Array.from(restored.blob).join(',') === '1,2,3,4',
    };
  });
  ok('snapshot: manifest counts the seeded records', snap.manifestCount === 2);
  ok('snapshot: wipe empties the store', snap.afterWipe === 0);
  ok('snapshot: restore brings data back', snap.restoredV === 42);
  ok('snapshot: binary (Uint8Array) value round-trips', snap.blobOk);

  // ---- 3. Each adapter against the mocked fetch ----
  const adapters = await page.evaluate(async () => {
    const { getStore } = window.__backup;
    const f = window.__mockFetch;
    const payload = new Uint8Array([10, 20, 30, 40, 50]);
    const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const out = {};

    // GitHub
    {
      const cfg = { repo: 'me/backups', token: 't', fetchImpl: f };
      const gh = getStore('github');
      await gh.put('snap1', payload, cfg);
      const got = await gh.get('snap1', cfg);
      const lst = await gh.list(cfg);
      const sawPut = window.__calls.some((c) => c.method === 'PUT' && /\/contents\/edot-backups\/snap1\.enc/.test(c.url));
      await gh.remove('snap1', cfg);
      const after = await gh.list(cfg);
      out.github = { get: eq(got, payload), listed: lst.some((x) => x.id === 'snap1'), sawPut, removed: !after.some((x) => x.id === 'snap1') };
    }
    // S3 (presigned-URL seam)
    {
      const presign = (method, key) => `https://s3.mock/bucket?s3key=${encodeURIComponent(key)}`;
      const listUrl = 'https://s3.mock/bucket?op=list-s3';
      const cfg = { presign, listUrl, prefix: 'edot-backups', fetchImpl: f };
      const s3 = getStore('s3');
      await s3.put('snap2', payload, cfg);
      const got = await s3.get('snap2', cfg);
      const lst = await s3.list(cfg);
      await s3.remove('snap2', cfg);
      const after = await s3.list(cfg);
      out.s3 = { get: eq(got, payload), listed: lst.some((x) => x.id === 'snap2'), removed: !after.some((x) => x.id === 'snap2') };
    }
    // WebDAV
    {
      const cfg = { baseUrl: 'https://dav.mock/dav/edot-backups', user: 'u', password: 'p', fetchImpl: f };
      const wd = getStore('webdav');
      await wd.put('snap3', payload, cfg);
      const got = await wd.get('snap3', cfg);
      const lst = await wd.list(cfg);
      const sawPropfind = window.__calls.some((c) => c.method === 'PROPFIND');
      await wd.remove('snap3', cfg);
      const after = await wd.list(cfg);
      out.webdav = { get: eq(got, payload), listed: lst.some((x) => x.id === 'snap3'), sawPropfind, removed: !after.some((x) => x.id === 'snap3') };
    }
    // Solid
    {
      const cfg = { container: 'http://127.0.0.1/pod/edot-backups/', token: 'bearer-xyz', fetchImpl: f };
      const sd = getStore('solid');
      await sd.put('snap4', payload, cfg);
      const got = await sd.get('snap4', cfg);
      const lst = await sd.list(cfg);
      const sawContainerGet = window.__calls.some((c) => c.method === 'GET' && c.url.endsWith('/pod/edot-backups/'));
      await sd.remove('snap4', cfg);
      const after = await sd.list(cfg);
      out.solid = { get: eq(got, payload), listed: lst.some((x) => x.id === 'snap4'), sawContainerGet, removed: !after.some((x) => x.id === 'snap4') };
    }
    return out;
  });
  for (const [name, r] of Object.entries(adapters)) {
    ok(`${name}: put→get returns identical bytes`, r.get);
    ok(`${name}: list returns the put id`, r.listed);
    ok(`${name}: remove works`, r.removed);
  }
  ok('github: issues a Contents PUT', adapters.github.sawPut);
  ok('webdav: list issues a PROPFIND', adapters.webdav.sawPropfind);
  ok('solid: list issues a container GET', adapters.solid.sawContainerGet);

  // ---- 4. End-to-end: snapshot → encrypt → github put → get → decrypt ----
  const e2e = await page.evaluate(async () => {
    const { crypto: C, snapshot: S, getStore } = window.__backup;
    const f = window.__mockFetch;
    const { bytes, manifest } = await S.createSnapshot({ databases: [{ name: 'edot-grid', stores: '*' }] });
    const env = await C.encryptSnapshot(bytes, 'e2e-pass');
    const cfg = { repo: 'me/backups', token: 't', fetchImpl: f };
    await getStore('github').put('e2e', env, cfg);
    const fetched = await getStore('github').get('e2e', cfg);
    const plain = await C.decryptSnapshot(fetched, 'e2e-pass');
    const same = plain.length === bytes.length && plain.every((b, i) => b === bytes[i]);
    const m2 = await S.readSnapshotManifest(plain);
    return { same, shaMatch: m2.sha256 === manifest.sha256 };
  });
  ok('e2e: snapshot→encrypt→put→get→decrypt recovers bytes', e2e.same);
  ok('e2e: restored snapshot fingerprint matches', e2e.shaMatch);

  // ---- 5. UI: renders, ALPHA badge present, backup-then-list via the component ----
  const uiBadge = await page.evaluate(() => {
    const c = window.__backup.component();
    const badge = c.querySelector('.bk-badge');
    return { hasBadge: !!badge && /ALPHA/i.test(badge.textContent), hasWarn: !!c.querySelector('.bk-warn'), hasBackup: !!c.querySelector('#bk-backup') };
  });
  ok('ui: ALPHA badge present', uiBadge.hasBadge);
  ok('ui: experimental warning present', uiBadge.hasWarn);
  ok('ui: renders the Back up control', uiBadge.hasBackup);

  // Drive the component end-to-end with the mocked fetch injected.
  const uiFlow = await page.evaluate(async () => {
    const c = window.__backup.component();
    c._fetchImpl = window.__mockFetch;
    c.backend = 'github'; c.cfg = { repo: 'me/ui', token: 't', dir: 'edot-backups', branch: '' };
    c.querySelector('#bk-pass').value = 'ui-pass';
    await c.doBackup();
    const status = c.querySelector('#bk-status').textContent;
    const fpShown = !c.querySelector('#bk-fp').hidden;
    await c.refreshList();
    const listed = c.querySelectorAll('.bk-item').length;
    return { ok: /Backed up/.test(status), fpShown, listed };
  });
  ok('ui: backup via component succeeds', uiFlow.ok);
  ok('ui: SHA-256 fingerprint shown after backup', uiFlow.fpShown);
  ok('ui: snapshot appears in the list', uiFlow.listed >= 1);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nBACKUP OK');
process.exit(fail ? 1 : 0);
