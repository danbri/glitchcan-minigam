// Tests of pod-summary.mjs and pod-davmount.mjs, against fixture pods in a temp directory.
// No relay and no browser. A fixture is made by the real Factoidal engine; the "running
// pod" is the real pod.mjs on a fixture. Exit 0 when every check passes.
//
//   cd packages/foafos/pod && npm run test:tools
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { connect } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLwsStorage } from '@factoidal/core/lws';
import { canonical, listenDav, parsePropfind } from '../pod-dav.mjs';
import { readPod } from '../pod-read.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SUMMARY = resolve(here, '../pod-summary.mjs');
const DAVMOUNT = resolve(here, '../pod-davmount.mjs');
const POD = resolve(here, '../pod.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'pod-tools-'));

let passed = 0;
let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (cond) passed += 1; else failed += 1; };
const children = [];
const cleanup = () => {
  for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } }
  try { execFileSync('chmod', ['-R', 'u+rwX', tmp]); rmSync(tmp, { recursive: true, force: true }); } catch { /* the OS clears it */ }
};

const enc = new TextEncoder();
const HOST = [['Host', 'pod.example']];
const INBOX_TOKEN = `INBOXTOKEN${randomBytes(8).toString('hex')}`;
const BODY_MARKER = `BODYMARKER${randomBytes(8).toString('hex')}`;

/** A fixture pod, made by the engine. The journal is left in place, as a running pod leaves it. */
async function makePod(dir, { subscribe = true, ...options } = {}) {
  const s = await openLwsStorage({ baseIri: 'https://pod.example/', dir, realClock: true, insecureNoAuth: true, ...options });
  const step = (method, target, type, body = '') => s.step({ method, target,
    headers: [...(type ? [['Content-Type', type]] : []), ...HOST], body: typeof body === 'string' ? enc.encode(body) : body });
  await step('PUT', '/notes/a.txt', 'text/plain', 'first version');
  await step('PUT', '/notes/a.txt', 'text/plain', `hello ${BODY_MARKER}`);
  await step('PUT', '/notes/deep/b.json', 'application/json', '{"x":1}');
  await step('PUT', '/my%20notes/a%20b%C3%A9%26%3C.txt', 'text/plain', 'spaced');
  await step('PUT', '/photo.bin', 'application/octet-stream', Uint8Array.from({ length: 4096 }, (_, i) => i % 251));
  await step('PUT', '/empty.txt', 'text/plain', '');
  await step('PUT', '/gone.txt', 'text/plain', 'bye');
  await step('DELETE', '/gone.txt');
  if (subscribe) {
    await step('POST', '/.well-known/lws-subscriptions/', 'application/lws+json',
      JSON.stringify({ type: 'WebhookSubscription', topic: ['https://pod.example/'], inbox: `https://hook.example/in?tok=${INBOX_TOKEN}` }));
  }
  s.close();
}

/** Every path, mode, size, mtime, ctime and content under dir. Read time (atime) is left out. */
function hashTree(dir) {
  const lines = [];
  const walk = (at) => {
    for (const name of readdirSync(at).sort()) {
      const file = join(at, name);
      const s = lstatSync(file);
      const rel = file.slice(dir.length);
      if (s.isDirectory()) { lines.push(`d ${rel} ${s.mode} ${s.mtimeMs} ${s.ctimeMs}`); walk(file); }
      else lines.push(`f ${rel} ${s.mode} ${s.size} ${s.mtimeMs} ${s.ctimeMs} ${createHash('sha256').update(readFileSync(file)).digest('hex')}`);
    }
  };
  walk(dir);
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

const summary = (...args) => {
  const r = spawnSync(process.execPath, [SUMMARY, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
};
const summaryJson = (dir) => JSON.parse(summary(dir, '--json').out);
const shape = (report) => report.entries.map(({ path, kind, contentType, size, modified, body }) => ({ path, kind, contentType, size, modified, body }));

// ---------------------------------------------------------------------------
// pod-summary
const podA = join(tmp, 'a');
await makePod(podA);
const rawIndex = JSON.parse(readFileSync(join(podA, 'lws-files.json'), 'utf8'));
const SIGNING_KEY = rawIndex.notifications.signingKey;
check(typeof SIGNING_KEY === 'string' && SIGNING_KEY.length > 20, 'the fixture holds a signing key');
check(readFileSync(join(podA, 'lws-journal')).includes(INBOX_TOKEN), 'the fixture journal holds the inbox token');

// Negative control: the hash sees what it is there to see.
{
  const pod = join(tmp, 'a-control');
  cpSync(podA, pod, { recursive: true });
  const start = hashTree(pod);
  check(hashTree(pod) === start, 'control: the hash is stable with no change');
  writeFileSync(join(pod, 'lws-files.json'), readFileSync(join(pod, 'lws-files.json')));
  const rewritten = hashTree(pod);
  check(rewritten !== start, 'control: the hash changes when a file is rewritten with the same bytes');
  writeFileSync(join(pod, 'new-file'), '');
  check(hashTree(pod) !== rewritten, 'control: the hash changes when a file is added');
}

{
  const before = hashTree(podA);
  const text = summary(podA);
  const json = summary(podA, '--json');
  check(text.code === 0 && json.code === 0, 'summary exits 0 in both modes');
  check(hashTree(podA) === before, 'closed pod: directory hash is the same after text and --json runs');

  const r = JSON.parse(json.out);
  const paths = r.entries.map((e) => e.path);
  check(r.journal.records > 0 && r.indexSeq === 0, 'the fixture state is in the journal, not in the index');
  check(paths.includes('/notes/deep/b.json') && !paths.includes('/gone.txt'), 'the journal is replayed: a put is there and a delete is gone');
  const a = r.entries.find((e) => e.path === '/notes/a.txt');
  check(a.size === `hello ${BODY_MARKER}`.length && a.contentType === 'text/plain', 'an overwrite shows the new size and the content type');
  check(/^\d{4}-\d\d-\d\dT/.test(a.modified), 'an entry has a date');
  check(r.contentTypes['text/plain'] === 3 && r.contentTypes['application/json'] === 1, 'content types are counted');
  check(r.subscriptions === 1 && r.grants === 0, 'counts come from the journal side state');
  check(r.orphans.length === 0 && r.bodyProblems.length === 0, 'a clean pod has no orphans and no body problems');
  check(r.lock.present === false, 'no lock on a closed pod');
  check(text.out.includes('grants   0') && text.out.includes('a bé&<.txt') && text.out.includes('deep/') && text.out.includes('orphan bodies: 0'), 'text output has the grant line, decoded names and the tree');
}

// Orphans, a missing body, a size fault, and a torn journal tail, on a copy.
{
  const pod = join(tmp, 'a-orphans');
  cpSync(podA, pod, { recursive: true });
  mkdirSync(join(pod, 'bodies/7f'), { recursive: true });
  writeFileSync(join(pod, 'bodies/7f/000000000000007f'), 'not recorded yet');
  const r0 = readPod(pod);
  const unusedNumber = Math.max(...[...r0.entries.values()].map((e) => e.body ?? 0)) - 1;
  const used = new Set([...r0.entries.values()].map((e) => e.body));
  const freeNumber = [...Array(r0.nextBody).keys()].find((n) => !used.has(n));
  check(freeNumber !== undefined && unusedNumber >= 0, 'the fixture has a free body number below nextBody');
  const hex = freeNumber.toString(16).padStart(16, '0');
  mkdirSync(join(pod, 'bodies', hex.slice(-2)), { recursive: true });
  writeFileSync(join(pod, 'bodies', hex.slice(-2), hex), 'left behind');
  writeFileSync(join(pod, 'bodies/7f/000000000000007f.tmp'), 'temp');
  const r = summaryJson(pod);
  const reasons = Object.fromEntries(r.orphans.map((o) => [o.file.split('/').pop(), o.reason]));
  check(r.orphans.length === 3, 'three orphan body files are found');
  check(reasons['000000000000007f'] === 'not-yet-recorded' && reasons['000000000000007f.tmp'] === 'temporary', 'a number past nextBody and a .tmp file have their reasons');
  check(Object.values(reasons).filter((v) => v === 'unused' || v === 'pending-remove').length === 1, 'a free number below nextBody is an orphan');

  const b = r.entries.find((e) => e.path === '/notes/deep/b.json').body;
  unlinkSync(join(pod, b));
  appendFileSync(join(pod, r.entries.find((e) => e.path === '/photo.bin').body), 'x');
  const r2 = summaryJson(pod);
  check(r2.bodyProblems.some((p) => p.path === '/notes/deep/b.json' && p.problem === 'missing'), 'a missing body is reported');
  check(r2.bodyProblems.some((p) => p.path === '/photo.bin' && p.problem.startsWith('size')), 'a body of the wrong size is reported');

  appendFileSync(join(pod, 'lws-journal'), Buffer.concat([Buffer.from('LWJ1'), Buffer.from([0, 0, 1, 0]), randomBytes(12)]));
  const r3 = summaryJson(pod);
  check(r3.journal.unreadBytes === 20 && r3.entries.length === r2.entries.length, 'a torn journal tail is counted and the valid records stand');
}

// The reader against the engine: a start compacts the journal into the index.
{
  const pod = join(tmp, 'a-compact');
  cpSync(podA, pod, { recursive: true });
  const replayed = summaryJson(pod);
  (await openLwsStorage({ baseIri: 'https://pod.example/', dir: pod, realClock: true, insecureNoAuth: true })).close();
  const compacted = summaryJson(pod);
  check(compacted.journal.records === 0 && compacted.indexSeq === replayed.seq, 'the engine compacted the fixture');
  check(JSON.stringify(shape(replayed)) === JSON.stringify(shape(compacted)), 'replay in this tool gives the same entries as compaction in the engine');
  check(compacted.subscriptions === 1, 'the subscription count is the same from the index');

  const index = JSON.parse(readFileSync(join(pod, 'lws-files.json'), 'utf8'));
  index.access.grants = [{ agent: 'a', token: 'GRANTSECRET1' }, { agent: 'b', token: 'GRANTSECRET2' }];
  writeFileSync(join(pod, 'lws-files.json'), JSON.stringify(index));
  const withGrants = summary(pod);
  check(withGrants.out.includes('grants   2') && !withGrants.all.includes('GRANTSECRET'), 'grants are counted and not printed (synthetic grants in the index)');
}

// A directory with no write permission: the tool needs none.
{
  const pod = join(tmp, 'a-readonly');
  cpSync(podA, pod, { recursive: true });
  execFileSync('chmod', ['-R', 'a-w', pod]);
  check(summary(pod).code === 0, 'summary runs on a directory with no write permission');
}

// Secrets, in every mode and on the fault paths.
{
  const secrets = [SIGNING_KEY, INBOX_TOKEN, BODY_MARKER];
  const clean = (text) => !secrets.some((s) => text.includes(s)) && !/signingKey|inbox|tok=/i.test(text);
  check(clean(summary(podA).all), 'text mode prints no signing key, no inbox token, no body content');
  check(clean(summary(podA, '--json').all), '--json prints no signing key, no inbox token, no body content');
  check(!JSON.stringify([...readPod(podA).entries.values()]).includes(SIGNING_KEY), 'the reader state holds no signing key');

  const broken = join(tmp, 'a-broken');
  cpSync(podA, broken, { recursive: true });
  const index = readFileSync(join(broken, 'lws-files.json'), 'utf8');
  writeFileSync(join(broken, 'lws-files.json'), index.replace(`"signingKey":"${SIGNING_KEY}"`, `"signingKey" "${SIGNING_KEY}"`));
  const fault = summary(broken);
  check(fault.code === 2 && fault.err.includes('not valid JSON') && !fault.all.includes(SIGNING_KEY), 'a broken index gives exit 2, and the message does not quote the key');
}

// A sealed storage: real seal, by the engine.
const sealedPod = join(tmp, 'sealed');
const STORAGE_KEY = randomBytes(32).toString('hex');
{
  await makePod(sealedPod, { storageKey: STORAGE_KEY });
  const keyId = JSON.parse(readFileSync(join(sealedPod, 'lws-files.json'), 'utf8')).keyId;
  const text = summary(sealedPod);
  const json = summary(sealedPod, '--json');
  const r = JSON.parse(json.out);
  check(text.code === 0 && r.sealed === true && r.bodyFiles.count > 0 && !('entries' in r), 'a sealed pod reports that it is sealed, with body counts and no tree');
  check(![STORAGE_KEY, keyId].some((s) => text.all.includes(s) || json.all.includes(s)), 'a sealed pod prints no key and no key id');
}

// Usage and a directory that is not a pod.
{
  check(summary().code === 2, 'no DIR is exit 2');
  const empty = join(tmp, 'empty');
  mkdirSync(empty);
  const r = summary(empty);
  check(r.code === 2 && r.err.includes('not a pod directory'), 'a directory with no index is exit 2');
}

// ---------------------------------------------------------------------------
// A running pod: the real pod.mjs holds lws.lock.
const podLive = join(tmp, 'live');
await makePod(podLive, { subscribe: false });   // a delivery retry would write to the journal during a hash
const livePort = 19000 + Math.floor(Math.random() * 20000);
const liveBase = `http://127.0.0.1:${livePort}/`;
const pod = spawn(process.execPath, [POD, '--base', liveBase, '--dir', podLive, '--http', String(livePort), '--insecure-no-auth', '--quiet'], { stdio: ['ignore', 'ignore', 'pipe'] });
children.push(pod);
pod.stderr.on('data', (d) => process.stderr.write(d));
for (let i = 0; i < 100; i += 1) {
  try { if ((await fetch(liveBase)).status < 500) break; } catch { /* not yet */ }
  await new Promise((r) => { setTimeout(r, 100); });
}
const livePut = (path, body) => fetch(new URL(path, liveBase), { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body });
{
  check((await livePut('/live-1.txt', 'from the running pod')).status === 201, 'the running pod takes a write');
  check(existsSync(join(podLive, 'lws.lock')), 'the running pod holds lws.lock');
  const lockText = readFileSync(join(podLive, 'lws.lock'), 'utf8');
  const lockToken = JSON.parse(lockText).token;
  check(typeof lockToken === 'string' && lockToken.length > 8, 'the lock holds a process token');

  const before = hashTree(podLive);
  const text = summary(podLive);
  const json = summary(podLive, '--json');
  check(text.code === 0 && json.code === 0, 'summary runs while the lock is held');
  check(hashTree(podLive) === before, 'running pod: directory hash is the same after text and --json runs');
  const r = JSON.parse(json.out);
  check(r.lock.pid === pod.pid && r.lock.alive === true, 'the report names the running pod process');
  check(r.entries.some((e) => e.path === '/live-1.txt'), 'a write to the running pod is in the report');
  check(!text.all.includes(lockToken) && !json.all.includes(lockToken), 'the lock token is not printed');

  // Reads during writes: every read gives a report.
  let writing = true;
  const writer = (async () => { for (let i = 0; writing; i += 1) await livePut(`/load/${i % 5}.txt`, `version ${i}`); })();
  let ok = 0;
  for (let i = 0; i < 12; i += 1) {
    const run = await new Promise((done) => {
      const c = spawn(process.execPath, [SUMMARY, podLive, '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      c.stdout.on('data', (d) => { out += d; });
      c.on('close', (code) => done({ code, out }));
    });
    try { if (run.code === 0 && JSON.parse(run.out).format === 'lws-files-1') ok += 1; } catch { /* counted as not ok */ }
  }
  writing = false;
  await writer;
  check(ok === 12, `12 of 12 reads during writes give a report (${ok})`);
}

// ---------------------------------------------------------------------------
// pod-davmount: the real CLI and a real HTTP client.
const transcript = [];

/** A raw request: the target and the Host go out as given. */
function http(port, method, target, { headers = {}, body, host } = {}) {
  return new Promise((done, fail) => {
    const req = request({ host: '127.0.0.1', port, method, path: target, setHost: false,
      headers: { Host: host ?? `127.0.0.1:${port}`, ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        transcript.push(JSON.stringify(res.headers), buffer.toString('latin1'));
        done({ status: res.statusCode, headers: res.headers, buffer, text: buffer.toString('utf8') });
      });
    });
    req.on('error', fail);
    req.end(body);
  });
}

function startMount(dir, ...args) {
  return new Promise((done, fail) => {
    const c = spawn(process.execPath, [DAVMOUNT, dir, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(c);
    let out = '';
    c.stdout.on('data', (d) => {
      out += d;
      const line = out.split('\n')[0];
      if (out.includes('\n')) done({ child: c, line, port: Number(/:(\d+)\/$/.exec(line)?.[1]) });
    });
    c.on('close', (code) => fail(new Error(`pod-davmount exited ${code}`)));
  });
}

const APPLE_PROPFIND = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:"><D:prop xmlns:A="http://www.apple.com/webdav_fs/props/">
<D:getlastmodified/><D:getcontentlength/><D:creationdate/><D:resourcetype/><D:quota-available-bytes/><A:appledoubleheader/>
</D:prop></D:propfind>`;
const hrefs = (xml) => [...xml.matchAll(/<D:href>([^<]*)<\/D:href>/g)].map((m) => m[1]);

{
  const before = hashTree(podA);
  const mount = await startMount(podA);
  const { port } = mount;
  const url = `http://127.0.0.1:${port}/`;
  check(mount.line === url, `the mount line is the URL (${mount.line})`);

  const opt = await http(port, 'OPTIONS', '/');
  check(opt.status === 200 && opt.headers.dav === '1' && opt.headers.allow === 'OPTIONS, GET, HEAD, PROPFIND', 'OPTIONS: class 1, and only the read methods');

  const root = await http(port, 'PROPFIND', '/', { headers: { Depth: '1' } });
  const rootHrefs = hrefs(root.text);
  check(root.status === 207 && root.headers['content-type'].startsWith('application/xml'), 'PROPFIND / gives 207 XML');
  check(['/', '/empty.txt', '/my%20notes/', '/notes/', '/photo.bin'].every((h) => rootHrefs.includes(h)) && rootHrefs.length === 5, `PROPFIND / Depth 1 lists the root and its members (${rootHrefs.length})`);
  check(root.text.includes('<D:collection/>') && root.text.includes('<D:getcontentlength>4096</D:getcontentlength>') && root.text.includes('<D:getcontenttype>application/octet-stream</D:getcontenttype>'), 'PROPFIND gives type, size and collection facts');

  const zero = await http(port, 'PROPFIND', '/notes', { headers: { Depth: '0' } });
  check(zero.status === 207 && JSON.stringify(hrefs(zero.text)) === '["/notes/"]', 'PROPFIND /notes Depth 0 answers for /notes/ only');

  const spaced = await http(port, 'PROPFIND', '/my%20notes/', { headers: { Depth: '1' } });
  check(spaced.text.includes('/my%20notes/a%20b%C3%A9%26%3C.txt') && spaced.text.includes('<D:displayname>a bé&amp;&lt;.txt</D:displayname>'), 'names are percent-encoded in href and XML-escaped in displayname');

  const apple = await http(port, 'PROPFIND', '/notes/a.txt', { headers: { Depth: '0', 'Content-Type': 'text/xml' }, body: APPLE_PROPFIND });
  const [ok200, ko404] = apple.text.split('</D:propstat>');
  check(apple.status === 207 && ok200.includes('getcontentlength') && ok200.includes('200 OK'), 'the PROPFIND that Finder sends: known properties in a 200 propstat');
  check(ko404.includes('404 Not Found') && ko404.includes('<appledoubleheader xmlns="http://www.apple.com/webdav_fs/props/"/>') && ko404.includes('<quota-available-bytes xmlns="DAV:"/>'), 'unknown properties in a 404 propstat, with their namespaces');

  const names = await http(port, 'PROPFIND', '/notes/a.txt', { headers: { Depth: '0' }, body: '<propfind xmlns="DAV:"><propname/></propfind>' });
  check(names.text.includes('<D:getetag/>') && !names.text.includes(BODY_MARKER), 'propname gives names with no values');

  check((await http(port, 'PROPFIND', '/._notes', { headers: { Depth: '0' } })).status === 404 && (await http(port, 'PROPFIND', '/.DS_Store', { headers: { Depth: '0' } })).status === 404, 'the AppleDouble and .DS_Store probes of Finder get 404');
  const infinity = await http(port, 'PROPFIND', '/');
  check(infinity.status === 403 && infinity.text.includes('propfind-finite-depth'), 'PROPFIND with no Depth is refused with 403 propfind-finite-depth');
  check((await http(port, 'PROPFIND', '/', { headers: { Depth: '0' }, body: '<nope' })).status === 400, 'a malformed PROPFIND body gets 400');
  check((await http(port, 'PROPFIND', '/', { headers: { Depth: '0' }, body: '<!DOCTYPE a [<!ENTITY x "y">]><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>' })).status === 400, 'a DTD gets 400');
  check((await http(port, 'PROPFIND', '/', { headers: { Depth: '0' }, body: `<a>${'x'.repeat(70000)}</a>` })).status === 413, 'an oversize PROPFIND body gets 413');

  const get = await http(port, 'GET', '/notes/a.txt');
  check(get.status === 200 && get.text === `hello ${BODY_MARKER}` && get.headers['content-type'] === 'text/plain', 'GET gives the current bytes and the content type');
  transcript.pop();   // this body is the fixture's own content, asked for by name
  check(get.headers['x-content-type-options'] === 'nosniff' && get.headers['content-security-policy'] === 'sandbox', 'GET sets nosniff and a sandbox policy');
  const bin = await http(port, 'GET', '/photo.bin');
  check(bin.buffer.equals(Buffer.from(Uint8Array.from({ length: 4096 }, (_, i) => i % 251))), '4096 binary bytes are identical');
  const empty = await http(port, 'GET', '/empty.txt');
  check(empty.status === 200 && empty.buffer.length === 0, 'an empty resource gives 200 and no bytes');
  const spacedGet = await http(port, 'GET', '/my%20notes/a%20b%C3%A9%26%3C.txt');
  check(spacedGet.text === 'spaced', 'GET finds a percent-encoded name');
  const listing = await http(port, 'GET', '/notes/');
  check(listing.status === 200 && listing.text === 'a.txt\ndeep/\n', 'GET on a collection gives a plain listing');

  const head = await http(port, 'HEAD', '/photo.bin');
  check(head.status === 200 && head.headers['content-length'] === '4096' && head.buffer.length === 0 && Boolean(head.headers.etag), 'HEAD gives the headers and no body');
  const range = await http(port, 'GET', '/photo.bin', { headers: { Range: 'bytes=10-19' } });
  check(range.status === 206 && range.headers['content-range'] === 'bytes 10-19/4096' && range.buffer.equals(bin.buffer.subarray(10, 20)), 'a Range GET gives 206 and the right bytes');
  const tail = await http(port, 'GET', '/photo.bin', { headers: { Range: 'bytes=-5' } });
  check(tail.status === 206 && tail.buffer.equals(bin.buffer.subarray(4091)), 'a suffix Range works');
  check((await http(port, 'GET', '/photo.bin', { headers: { Range: 'bytes=5000-' } })).status === 416, 'a Range past the end gets 416');
  check((await http(port, 'GET', '/photo.bin', { headers: { 'If-None-Match': head.headers.etag } })).status === 304, 'If-None-Match gives 304');
  check((await http(port, 'GET', '/photo.bin', { headers: { 'If-Modified-Since': head.headers['last-modified'] } })).status === 304, 'If-Modified-Since gives 304');
  check((await http(port, 'GET', '/nothing.txt')).status === 404, 'GET of nothing gets 404');
  check((await http(port, 'GET', '/notes/a.txt/')).status === 404, 'a file with a trailing slash gets 404');

  for (const method of ['PUT', 'DELETE', 'MKCOL', 'COPY', 'MOVE', 'PROPPATCH', 'LOCK', 'UNLOCK', 'POST', 'PATCH']) {
    const r = await http(port, method, '/notes/a.txt', { body: method === 'PUT' ? 'overwritten' : undefined, headers: { Destination: `${url}x` } });
    check(r.status === 405 && r.headers.allow === 'OPTIONS, GET, HEAD, PROPFIND', `${method} is refused with 405`);
  }
  const expect = await new Promise((done, fail) => {
    const req = request({ host: '127.0.0.1', port, method: 'PUT', path: '/x.txt', headers: { Expect: '100-continue', 'Content-Length': 5 } }, (res) => { res.resume(); res.on('end', () => done({ status: res.statusCode, continued: req.continued === true })); });
    req.on('continue', () => { req.continued = true; });
    req.on('error', fail);
    req.flushHeaders();
    setTimeout(() => req.destroy(), 2000).unref();
  });
  check(expect.status === 405 && !expect.continued, 'a PUT with Expect: 100-continue gets 405, not 100');

  for (const target of ['/lws-files.json', '/lws-journal', '/lws.lock', '/bodies/', '/bodies/00/0000000000000000',
    '/../lws-files.json', '/%2e%2e/lws-files.json', '/notes/../../lws-files.json', '/..%2flws-files.json', '/notes//a.txt', '/a%00b', '/%ff']) {
    check((await http(port, 'GET', target)).status === 404, `GET ${target} gets 404`);
  }
  const absolute = await http(port, 'GET', 'http://evil.example/lws-files.json');
  check(absolute.status === 404, 'an absolute-form target gets 404');

  check((await http(port, 'GET', '/', { host: 'evil.example' })).status === 421, 'a foreign Host gets 421');
  check((await http(port, 'PROPFIND', '/', { host: `evil.example:${port}`, headers: { Depth: '1' } })).status === 421, 'PROPFIND with a foreign Host gets 421');
  check((await http(port, 'GET', '/', { host: `localhost:${port}` })).status === 200, 'localhost:PORT is a good Host');
  check((await http(port, 'GET', '/notes/a.txt', { headers: { Origin: 'https://evil.example' } })).status === 403, 'a foreign Origin gets 403');
  check((await http(port, 'GET', '/photo.bin', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status === 403, 'a cross-site browser fetch gets 403');
  check(!('access-control-allow-origin' in get.headers), 'no CORS header');

  // Standard clients.
  const viaFetch = await fetch(`${url}notes/deep/b.json`);
  check(viaFetch.status === 200 && await viaFetch.text() === '{"x":1}', 'fetch reads a resource');
  const viaFetchDav = await fetch(url, { method: 'PROPFIND', headers: { Depth: '1' } });
  check(viaFetchDav.status === 207, 'fetch PROPFIND gives 207');
  const hasCurl = spawnSync('curl', ['--version']).status === 0;
  if (hasCurl) {
    const curl = (...args) => execFileSync('curl', ['-sS', ...args], { encoding: 'utf8' });
    check(curl('-X', 'PROPFIND', '-H', 'Depth: 1', `${url}notes/`).includes('<D:href>/notes/deep/</D:href>'), 'curl PROPFIND lists a collection');
    check(curl('-r', '0-4', `${url}notes/a.txt`) === 'hello', 'curl reads a byte range');
    check(curl('-o', '/dev/null', '-w', '%{http_code}', '-T', SUMMARY, `${url}x.mjs`) === '405', 'curl upload of a real file gets 405');
    const big = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop>${'<D:displayname/>'.repeat(200)}</D:prop></D:propfind>`;
    check(curl('-X', 'PROPFIND', '-H', 'Depth: 0', '-H', 'Expect: 100-continue', '--data-binary', big, '-o', '/dev/null', '-w', '%{http_code}', url) === '207', 'PROPFIND with Expect: 100-continue gets its body and gives 207');
  } else console.log('NOTE curl is not on PATH: the curl checks did not run');

  // Loopback only: the machine's other addresses refuse.
  const lan = Object.values(networkInterfaces()).flat().find((i) => i.family === 'IPv4' && !i.internal);
  if (lan) {
    const reached = await new Promise((done) => {
      const s = connect({ host: lan.address, port, timeout: 1000 });
      s.on('connect', () => { s.destroy(); done(true); });
      s.on('error', () => done(false));
      s.on('timeout', () => { s.destroy(); done(false); });
    });
    check(!reached, 'the port does not answer on the LAN address');
  } else console.log('NOTE no LAN address: the bind check did not run');

  const all = transcript.join('\n');
  check(![SIGNING_KEY, INBOX_TOKEN].some((s) => all.includes(s)) && !/signingKey/i.test(all), 'no DAV response holds the signing key or the inbox token');
  check(hashTree(podA) === before, 'pod directory hash is the same after the whole WebDAV session');

  mount.child.removeAllListeners('close');
  const exited = new Promise((done) => { mount.child.on('close', done); });
  mount.child.kill('SIGTERM');
  check(await exited === 0, 'SIGTERM stops the server with exit 0');
}

// Beside the running pod: no lock needed, and new writes show with no restart.
{
  const before = hashTree(podLive);
  const mount = await startMount(podLive);
  check((await http(mount.port, 'GET', '/live-1.txt')).text === 'from the running pod', 'the mount reads a pod whose lock is held');
  check(hashTree(podLive) === before, 'the mount changes nothing in a running pod directory');
  await livePut('/live-2.txt', 'second');
  const seen = await http(mount.port, 'PROPFIND', '/live-2.txt', { headers: { Depth: '0' } });
  check(seen.status === 207, 'a new write to the running pod shows with no restart');
  await livePut('/live-2.txt', 'second, longer');
  check((await http(mount.port, 'GET', '/live-2.txt')).text === 'second, longer', 'an overwrite shows the new bytes');
  mount.child.removeAllListeners('close');
  mount.child.kill('SIGKILL');
}

// A body that vanished: a 503 with no detail, not a hang.
{
  const pod2 = join(tmp, 'a-lost');
  cpSync(podA, pod2, { recursive: true });
  const r = summaryJson(pod2);
  unlinkSync(join(pod2, r.entries.find((e) => e.path === '/notes/deep/b.json').body));
  const mount = await startMount(pod2);
  const lost = await http(mount.port, 'GET', '/notes/deep/b.json');
  check(lost.status === 503 && !lost.text.includes(pod2), 'a lost body gets 503 and the message names no path');
  mount.child.removeAllListeners('close');
  mount.child.kill('SIGKILL');
}

// Refusals at start.
{
  const refuse = (dir) => spawnSync(process.execPath, [DAVMOUNT, dir], { encoding: 'utf8', timeout: 10000 });
  const sealed = refuse(sealedPod);
  check(sealed.status === 2 && sealed.stderr.includes('sealed') && sealed.stdout === '', 'a sealed pod is refused at start, exit 2');
  check(![STORAGE_KEY].some((s) => sealed.stderr.includes(s)), 'the refusal prints no key');
  check(refuse(join(tmp, 'empty')).status === 2, 'a directory that is not a pod is refused at start');
  check(spawnSync(process.execPath, [DAVMOUNT, podA, '--port', 'x'], { encoding: 'utf8' }).status === 2, 'a bad --port is exit 2');
}

// The backend seam: pod-dav.mjs works with a source that has no pod behind it.
{
  const files = new Map([['/', { path: '/', collection: true, size: 0, contentType: '', mtime: null, etag: null }],
    ['/x%20y.txt', { path: '/x%20y.txt', collection: false, size: 3, contentType: 'text/plain', mtime: 1e12, etag: '"v1"' }]]);
  const running = await listenDav({
    async stat(path) { return files.get(path) ?? null; },
    async list(path) { return path === '/' ? [files.get('/x%20y.txt')] : []; },
    async read(_path, { start = 0, end = 2 } = {}) { return [Buffer.from('abc').subarray(start, end + 1)]; },
  });
  check(running.server.address().address === '127.0.0.1', 'listenDav binds 127.0.0.1');
  const dav = await http(running.port, 'PROPFIND', '/', { headers: { Depth: '1' } });
  check(hrefs(dav.text).includes('/x%20y.txt'), 'a memory backend lists through the same WebDAV side');
  check((await http(running.port, 'GET', '/x%20y.txt', { headers: { Range: 'bytes=1-1' } })).text === 'b', 'a memory backend reads a range');
  await running.close();
  const failing = await listenDav({ async stat() { throw new Error('SECRET DETAIL'); }, async list() { return []; }, async read() { return []; } });
  const down = await http(failing.port, 'GET', '/');
  check(down.status === 503 && !down.text.includes('SECRET'), 'a backend fault is a 503 with no detail');
  await failing.close();
  const imports = [...readFileSync(resolve(here, '../pod-dav.mjs'), 'utf8').matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  check(imports.every((name) => name.startsWith('node:')), `pod-dav.mjs imports only node: modules (${imports.join(', ')})`);

  check(canonical('/a%20b/c') === '/a%20b/c' && canonical('/a b') === '/a%20b' && canonical('/a/../b') === null && canonical('x') === null, 'canonical() normalises and refuses');
  check(parsePropfind('').mode === 'allprop' && parsePropfind("<?xml version='1.0'?><!-- c --><a:propfind xmlns:a='DAV:'><a:prop><b:x xmlns:b='urn:b'/></a:prop></a:propfind>").props[0].ns === 'urn:b', 'parsePropfind reads prefixes and namespaces');
}

pod.kill('SIGKILL');
await new Promise((r) => { pod.on('close', r); });
{
  const r = summaryJson(podLive);
  check(r.lock.present === true && r.lock.alive === false, 'a lock left by a dead pod shows as stale');
}

cleanup();
console.log(`${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
