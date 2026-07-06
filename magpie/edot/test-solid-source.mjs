// test-solid-source.mjs — the REAL Solid pod storage mount (SolidResourceSource)
// over LDP. Pure Node: a fake fetch simulates a pod so request shaping
// (GET/PUT/DELETE/HEAD, Bearer auth, container listing via ldp:contains,
// container creation) and ResourceSource semantics are verified offline. The
// live network path is not CI-checked (standing headless rule).
import { SolidResourceSource } from './js/resource-source.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

const BASE = 'https://alice.pod.example/edot';
const files = new Map();                 // absolute url -> Uint8Array
const containers = new Set([BASE + '/']);
const calls = [];
const H = (obj) => ({ get: (k) => obj[k] || obj[k.toLowerCase()] || null });

function fakeFetch(url, opts = {}) {
  const method = opts.method || 'GET';
  calls.push({ method, url, auth: (opts.headers || {}).Authorization || null, link: (opts.headers || {}).Link || null });
  const isContainer = url.endsWith('/');
  if (method === 'GET') {
    if (isContainer) {
      if (!containers.has(url)) return Promise.resolve({ ok: false, status: 404, headers: H({}), async text() { return ''; } });
      // emit a Turtle container description with ldp:contains for direct children
      const members = [];
      for (const c of containers) { if (c !== url && c.startsWith(url) && c.slice(url.length).replace(/\/$/, '').indexOf('/') === -1) members.push(`<${c}>`); }
      for (const f of files.keys()) { if (f.startsWith(url) && f.slice(url.length).indexOf('/') === -1) members.push(`<${f}>`); }
      const ttl = `@prefix ldp: <http://www.w3.org/ns/ldp#> .\n<${url}> a ldp:BasicContainer ; ldp:contains ${members.join(', ') || '<>'} .`;
      return Promise.resolve({ ok: true, status: 200, headers: H({ 'Content-Type': 'text/turtle' }), async text() { return ttl; } });
    }
    if (!files.has(url)) return Promise.resolve({ ok: false, status: 404, headers: H({}), async text() { return ''; } });
    return Promise.resolve({ ok: true, status: 200, headers: H({}), async arrayBuffer() { return files.get(url).buffer; }, async text() { return ''; } });
  }
  if (method === 'HEAD') {
    if (containers.has(url.endsWith('/') ? url : url + '/')) return Promise.resolve({ ok: true, status: 200, headers: H({ Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' }) });
    if (files.has(url)) return Promise.resolve({ ok: true, status: 200, headers: H({ 'Content-Length': String(files.get(url).length) }) });
    return Promise.resolve({ ok: false, status: 404, headers: H({}) });
  }
  if (method === 'PUT') {
    if (isContainer) { containers.add(url); return Promise.resolve({ ok: true, status: 201, headers: H({}) }); }
    files.set(url, opts.body instanceof Uint8Array ? opts.body : new Uint8Array(opts.body)); return Promise.resolve({ ok: true, status: 201, headers: H({}) });
  }
  if (method === 'DELETE') { const had = files.delete(url) || containers.delete(url); return Promise.resolve({ ok: had, status: had ? 204 : 404, headers: H({}) }); }
  return Promise.resolve({ ok: false, status: 400, headers: H({}) });
}

const pod = new SolidResourceSource({ id: 'pod1', baseUrl: BASE, token: 'tok123', fetchImpl: fakeFetch });

ok('it is a remote solid storage mount', pod.provider === 'solid' && pod.capability === 'storage' && pod.locality === 'remote');

await pod.write('/notes/todo.md', enc('# buy milk'));
ok('write then read round-trips over LDP', dec(await pod.read('/notes/todo.md')) === '# buy milk');
ok('write creates the parent container (PUT + BasicContainer Link)', calls.some((c) => c.method === 'PUT' && c.url === BASE + '/notes/' && /BasicContainer/.test(c.link || '')));
ok('requests carry the Bearer token', calls.filter((c) => c.method !== 'GET' || c.url.endsWith('/')).every((c) => c.auth === 'Bearer tok123'));

await pod.write('/notes/done.md', enc('shipped'));
await pod.write('/photos/a.txt', enc('x'));
const root = (await pod.list('/')).map((e) => `${e.kind}:${e.name}`);
ok('list of root shows child containers before files', root.join(',') === 'folder:notes,folder:photos');
const inNotes = (await pod.list('/notes')).map((e) => e.name);
ok('list of a container shows its resources (via ldp:contains)', inNotes.join(',') === 'done.md,todo.md');
ok('stat a resource reports a file', (await pod.stat('/notes/todo.md')).kind === 'file');
ok('stat a container reports a folder', (await pod.stat('/notes')).kind === 'folder');
ok('stat a missing path is null', (await pod.stat('/nope.md')) === null);

await pod.remove('/notes/done.md');
ok('remove deletes the resource', (await pod.stat('/notes/done.md')) === null);

ok('verify() reads the base container and resolves', await pod.verify() === true);
ok('a missing baseUrl is rejected at construction', (() => { try { new SolidResourceSource({ token: 't' }); return false; } catch { return true; } })());

console.log(fail ? `\n${fail} SOLID-SOURCE FAILURE(S)` : '\nSOLID-SOURCE OK');
process.exit(fail ? 1 : 0);
