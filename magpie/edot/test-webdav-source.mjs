// test-webdav-source.mjs — the REAL WebDAV storage mount (WebDavResourceSource).
// Pure Node: a fake fetch simulates a WebDAV collection so request shaping
// (PROPFIND/GET/PUT/DELETE/MKCOL, Basic auth, hierarchical paths, multistatus
// parsing) and ResourceSource semantics are verified offline. The live network
// path is not CI-checked (standing headless rule).
import { WebDavResourceSource } from './js/resource-source.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

// ---- fake WebDAV server: a map of path -> bytes, dirs as a set ----
const files = new Map();          // '/dav/notes/todo.md' -> Uint8Array
const dirs = new Set(['/dav/']);
const calls = [];
const BASE = '/dav';
const res = (status, body = '', ct = 'application/xml') => ({ ok: status >= 200 && status < 300, status, async text() { return body; }, async arrayBuffer() { return (files.get(body) || new Uint8Array()).buffer; } });

function propfindXml(paths) {
  const one = (href, isDir, size) => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>`
    + `<d:resourcetype>${isDir ? '<d:collection/>' : ''}</d:resourcetype>`
    + (isDir ? '' : `<d:getcontentlength>${size}</d:getcontentlength>`)
    + `<d:getlastmodified>Mon, 01 Jan 2026 00:00:00 GMT</d:getlastmodified>`
    + `</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${paths.map((p) => one(p.href, p.isDir, p.size)).join('')}</d:multistatus>`;
}

function fakeFetch(url, opts = {}) {
  const u = new URL(url, 'http://dav.example');
  const p = decodeURIComponent(u.pathname);
  const method = opts.method || 'GET';
  calls.push({ method, path: p, auth: (opts.headers || {}).Authorization || null, depth: (opts.headers || {}).Depth });
  if (method === 'PROPFIND') {
    const dir = p.endsWith('/') ? p : p + '/';
    if (opts.headers.Depth === '0') {
      if (files.has(p)) return Promise.resolve(res(207, propfindXml([{ href: p, isDir: false, size: files.get(p).length }])));
      if (dirs.has(dir)) return Promise.resolve(res(207, propfindXml([{ href: dir, isDir: true }])));
      return Promise.resolve(res(404));
    }
    if (!dirs.has(dir)) return Promise.resolve(res(404));
    const kids = [{ href: dir, isDir: true }]; // self
    for (const d of dirs) { if (d !== dir && d.startsWith(dir) && d.slice(dir.length).replace(/\/$/, '').indexOf('/') === -1 && d !== dir) kids.push({ href: d, isDir: true }); }
    for (const [f, b] of files) { if (f.startsWith(dir) && f.slice(dir.length).indexOf('/') === -1) kids.push({ href: f, isDir: false, size: b.length }); }
    return Promise.resolve(res(207, propfindXml(kids)));
  }
  if (method === 'GET') { if (!files.has(p)) return Promise.resolve(res(404)); return Promise.resolve({ ok: true, status: 200, async arrayBuffer() { return files.get(p).buffer; }, async text() { return ''; } }); }
  if (method === 'PUT') { files.set(p, opts.body instanceof Uint8Array ? opts.body : new Uint8Array(opts.body)); return Promise.resolve(res(201)); }
  if (method === 'MKCOL') { const d = p.endsWith('/') ? p : p + '/'; if (dirs.has(d)) return Promise.resolve(res(405)); dirs.add(d); return Promise.resolve(res(201)); }
  if (method === 'DELETE') { const had = files.delete(p) || dirs.delete(p.endsWith('/') ? p : p + '/'); return Promise.resolve(res(had ? 204 : 404)); }
  return Promise.resolve(res(400));
}

const dav = new WebDavResourceSource({ id: 'dav1', baseUrl: 'http://dav.example/dav', user: 'ada', password: 'pw', fetchImpl: fakeFetch });

ok('it is a remote webdav storage mount', dav.provider === 'webdav' && dav.capability === 'storage' && dav.locality === 'remote');

// write (auto-creates parent collection) then read
await dav.write('/notes/todo.md', enc('# buy milk'));
ok('write then read round-trips over WebDAV', dec(await dav.read('/notes/todo.md')) === '# buy milk');
ok('write MKCOLs the parent collection first', calls.some((c) => c.method === 'MKCOL' && c.path.replace(/\/$/, '') === '/dav/notes'));
ok('requests carry HTTP Basic auth', calls.every((c) => c.auth === 'Basic ' + Buffer.from('ada:pw').toString('base64')));

// nested + listing + stat
await dav.write('/notes/done.md', enc('shipped'));
await dav.write('/photos/a.txt', enc('x'));
const root = (await dav.list('/')).map((e) => `${e.kind}:${e.name}`);
ok('list of root shows child collections before files', root.join(',') === 'folder:notes,folder:photos');
const inNotes = (await dav.list('/notes')).map((e) => e.name);
ok('list of a folder shows its files (self-entry excluded)', inNotes.join(',') === 'done.md,todo.md');
ok('stat a file reports kind + size', (await dav.stat('/notes/todo.md')).kind === 'file' && (await dav.stat('/notes/todo.md')).size === 10);
ok('stat a collection reports a folder', (await dav.stat('/notes')).kind === 'folder');
ok('stat a missing path is null', (await dav.stat('/nope.md')) === null);

// PROPFIND uses Depth:1 for a listing, Depth:0 for a stat
ok('listing uses Depth:1, stat uses Depth:0', calls.some((c) => c.method === 'PROPFIND' && c.depth === '1') && calls.some((c) => c.method === 'PROPFIND' && c.depth === '0'));

// remove
await dav.remove('/notes/done.md');
ok('remove deletes the file', (await dav.stat('/notes/done.md')) === null);

// verify() probes the base collection
ok('verify() probes the collection and resolves', await dav.verify() === true);

// bad config rejected up front
ok('a missing baseUrl is rejected at construction', (() => { try { new WebDavResourceSource({ user: 'x' }); return false; } catch { return true; } })());

console.log(fail ? `\n${fail} WEBDAV-SOURCE FAILURE(S)` : '\nWEBDAV-SOURCE OK');
process.exit(fail ? 1 : 0);
