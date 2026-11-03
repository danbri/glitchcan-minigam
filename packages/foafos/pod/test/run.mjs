// End-to-end test of LWS over XMPP (XEP-0332):
//   browser (Chromium) --RFC 7395 WebSocket--> relay --c2s--> pod.mjs --> Factoidal LWS engine
//
//   cd packages/foafos/pod && npm install && node test/run.mjs
// The relay is one of:
//   RELAY=prosody    prosody on PATH (apt-get install -y prosody); the default when it is there
//   RELAY=factoidal  Factoidal's Lean XMPP server; FACTOIDAL_BIN names its bin/factoidal.mjs,
//                    from a build with `xmpp-serve --ws-port` (RFC 7395)
// The browser: CHROMIUM_PATH, else /opt/pw-browsers (the Linux container), else the
// installed Google Chrome (Playwright channel "chrome"). Exit 0 when every check passes.
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { mkdtempSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLwsStorage } from '@factoidal/core/lws';
import { chromium } from 'playwright';
import { startXmpp, startHttp } from '../pod.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const cfg = join(here, 'prosody.cfg.lua');
let XMPP = 'xmpp://127.0.0.1:15222';
let WS = 'ws://127.0.0.1:15280/xmpp-websocket';
const BASE = 'https://pod.example/';
const POD = 'pod@localhost/lws';

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };

// 1. The relay, with fresh accounts.
const ACCOUNTS = [['pod', 'podpass'], ['user', 'userpass'], ['stranger', 'strangerpass']];
const hasProsody = (() => { try { execFileSync('which', ['prosody'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const RELAY = process.env.RELAY || (hasProsody ? 'prosody' : 'factoidal');
const data = mkdtempSync(join(tmpdir(), `${RELAY}-lws-`));
let relay;
if (RELAY === 'prosody') {
  const env = { ...process.env, PROSODY_DATA: data };
  for (const [u, p] of ACCOUNTS) {
    execFileSync('prosodyctl', ['--config', cfg, 'register', u, 'localhost', p], { env, stdio: 'ignore' });
  }
  relay = spawn('prosody', ['--config', cfg, '-F'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
} else if (RELAY === 'factoidal') {
  const bin = process.env.FACTOIDAL_BIN;
  if (!bin || !existsSync(bin)) {
    console.log('FAIL RELAY=factoidal needs FACTOIDAL_BIN=<factoidal-core>/npm/factoidal/bin/factoidal.mjs');
    process.exit(1);
  }
  writeFileSync(join(data, 'accounts'), ACCOUNTS.map(([u, p]) => `${u}:${p}\n`).join(''));
  // TLS on both listeners (XEP-0368 direct TLS, and wss:), as a real relay runs.
  // @xmpp/client has SCRAM-SHA-1 and PLAIN, and uses PLAIN only over TLS; this
  // server offers SCRAM-SHA-256 and PLAIN. The certificate is a throwaway
  // self-signed one, so this process and the browser skip verification.
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1',
    '-subj', '/CN=localhost', '-keyout', join(data, 'key.pem'), '-out', join(data, 'cert.pem')], { stdio: 'ignore' });
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  XMPP = 'xmpps://127.0.0.1:15222';
  WS = 'wss://127.0.0.1:15280/xmpp-websocket';
  relay = spawn(process.execPath, [bin, 'xmpp-serve', data, '--domain', 'localhost', '--port', '15222',
    '--cert', join(data, 'cert.pem'), '--key', join(data, 'key.pem'),
    '--ws-port', '15280', '--ws-path', '/xmpp-websocket', '--ws-origin', 'http://127.0.0.1:18765'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
} else {
  console.log(`FAIL unknown RELAY=${RELAY}`);
  process.exit(1);
}
console.log(`relay: ${RELAY}`);
const cleanup = () => { try { relay.kill(); } catch { /* gone */ } };
process.on('exit', cleanup);
process.on('uncaughtException', (e) => { console.error(e); cleanup(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); cleanup(); process.exit(1); });
let prosodyErr = '';
relay.stderr.on('data', (d) => { prosodyErr += d; });
const listening = (port) => new Promise((resolve) => {
  const s = connect(port, '127.0.0.1');
  s.on('connect', () => { s.destroy(); resolve(true); });
  s.on('error', () => resolve(false));
});
for (let i = 0; i < 80; i++) {
  if (await listening(15280) && await listening(15222)) break;
  await new Promise(r => setTimeout(r, 250));
}

// 2. The pod: one storage, HTTP and XMPP.
const storage = await openLwsStorage({ baseIri: BASE, insecureNoAuth: true, realClock: true });
const httpServer = await startHttp(storage, { port: 18787 });
const podXmpp = await startXmpp(storage, { service: XMPP, domain: 'localhost', username: 'pod', password: 'podpass',
  allow: new Set(['user@localhost']) });

// 3. A static server for the repo (the page and its modules).
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };
const files = createServer((req, res) => {
  const p = join(repo, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(repo) || !existsSync(p) || statSync(p).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream');
  res.end(readFileSync(p));
});
await new Promise(r => files.listen(18765, '127.0.0.1', r));

// 4. The browser.
const CONTAINER_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(CONTAINER_CHROME) ? CONTAINER_CHROME : undefined);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...(RELAY === 'factoidal' ? ['--ignore-certificate-errors'] : [])],
  ...(executablePath ? { executablePath } : { channel: 'chrome' }) });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:18765/packages/foafos/pod/test/blank.html');
await page.evaluate(async ({ WS, BASE, POD }) => {
  const { XmppWs } = await import('/packages/foafos/src/xmpp-ws.mjs');
  const { lwsStore, cachedBackend } = await import('/packages/foafos/src/lws-store.mjs');
  const { FoafStore } = await import('/packages/foafos/src/store.mjs');
  Object.assign(window, { XmppWs, lwsStore, cachedBackend, FoafStore, WS, BASE, POD });
  window.x = await XmppWs.connect({ url: WS, domain: 'localhost', username: 'user', password: 'userpass' });
  window.podFetch = x.httpFetch({ jid: POD, base: BASE });
}, { WS, BASE, POD });

const login = await page.evaluate(() => ({ jid: x.jid, mech: x.mechanism }));
check(login.jid?.startsWith('user@localhost/') && /SCRAM/.test(login.mech), `browser logs in over WebSocket with ${login.mech} as ${login.jid}`);

const root = await page.evaluate(async () => {
  const r = await podFetch(BASE, { headers: { Accept: 'application/lws+json' } });
  return { status: r.status, type: r.headers.get('content-type'), body: await r.json() };
});
check(root.status === 200 && root.type === 'application/lws+json' && root.body.id === BASE, `GET / over XMPP: ${root.status} ${root.type} id=${root.body.id}`);

const ns = 'miniapp.org.glitchcan.hello';
const w1 = await page.evaluate(async (ns) => {
  const s = lwsStore({ fetch: podFetch, base: BASE });
  const etag = await s.write(ns, { visits: '1' }, null);
  const back = await s.read(ns);
  return { etag, back, list: await s.list() };
}, ns);
check(w1.etag && w1.back.data.visits === '1' && w1.back.etag === w1.etag, `PUT then GET of apps/${ns}.json over XMPP (ETag ${w1.etag})`);
check(JSON.stringify(w1.list) === JSON.stringify([ns]), `container listing names the namespace: ${JSON.stringify(w1.list)}`);

// Same storage over HTTP from Node: the second carriage sees the first one's write.
const viaHttp = await (await fetch(`http://127.0.0.1:18787/apps/${encodeURIComponent(ns)}.json`)).json();
check(viaHttp.visits === '1', 'the HTTP carriage reads what the XMPP carriage wrote');

// A conflict: the browser's cached backend loads, another device writes over HTTP, the browser writes.
await page.evaluate(async (ns) => {
  window.events = [];
  window.backend = cachedBackend(lwsStore({ fetch: podFetch, base: BASE }), { onEvent: (t, d) => events.push(t) });
  await backend.load(ns);
  window.store = new FoafStore({ backend });
  store.grant(ns, ['storage']);
}, ns);
const cur = await fetch(`http://127.0.0.1:18787/apps/${encodeURIComponent(ns)}.json`);
const other = await fetch(`http://127.0.0.1:18787/apps/${encodeURIComponent(ns)}.json`, { method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'If-Match': cur.headers.get('etag') }, body: JSON.stringify({ visits: '1', theme: 'dark' }) });
check(other.status === 204, `another device writes over HTTP with If-Match: ${other.status}`);
const merged = await page.evaluate(async (ns) => {
  const r = store.set(ns, 'visits', '2');
  await backend.flushed();
  const remote = await (await podFetch(`${BASE}apps/${encodeURIComponent(ns)}.json`)).json();
  return { r, events, remote };
}, ns);
check(merged.r.ok && merged.events.join(',') === 'conflict-merged,synced', `FoafStore.set through the LWS backend: events ${merged.events.join(',')}`);
check(merged.remote.visits === '2' && merged.remote.theme === 'dark', `412 merged key by key: ${JSON.stringify(merged.remote)}`);

// Binary bytes survive the base64 carriage.
const bin = await page.evaluate(async () => {
  const bytes = new Uint8Array(4096).map((_, i) => (i * 37) & 255);
  const put = await podFetch(`${BASE}apps/blob.bin`, { method: 'PUT', body: bytes, headers: { 'Content-Type': 'application/octet-stream' } });
  const got = new Uint8Array(await (await podFetch(`${BASE}apps/blob.bin`)).arrayBuffer());
  return { put: put.status, same: got.length === bytes.length && got.every((b, i) => b === bytes[i]) };
});
check(bin.put === 201 && bin.same, `4096 binary bytes round-trip (PUT ${bin.put})`);

// Timing over the local relay.
const timing = await page.evaluate(async () => {
  const n = 50; const t0 = performance.now();
  for (let i = 0; i < n; i++) await podFetch(BASE, { method: 'HEAD' });
  return (performance.now() - t0) / n;
});
check(timing < 200, `HEAD over XMPP: ${timing.toFixed(1)} ms per request (local relay, 50 sequential)`);

// The direct HTTPS path from a page on another origin: blocked, because the engine sends no CORS headers.
const cors = await page.evaluate(async () => {
  try { const r = await fetch('http://127.0.0.1:18787/'); return `status ${r.status}`; } catch (e) { return `blocked: ${e.message}`; }
});
check(cors.startsWith('blocked'), `browser fetch straight to the pod's HTTP listener is ${cors} (no Access-Control-Allow-Origin)`);

// A JID not on the allow list.
const stranger = await page.evaluate(async () => {
  const s = await XmppWs.connect({ url: WS, domain: 'localhost', username: 'stranger', password: 'strangerpass' });
  const r = await s.httpFetch({ jid: POD, base: BASE })(BASE);
  s.close();
  return r.status;
});
check(stranger === 403, `a JID not on the pod's allow list gets ${stranger}`);

// Wrong password.
const badLogin = await page.evaluate(async () => {
  try { await XmppWs.connect({ url: WS, domain: 'localhost', username: 'user', password: 'nope' }); return 'logged in'; }
  catch (e) { return e.message; }
});
check(/failed/.test(badLogin), `wrong password refused: ${badLogin}`);

// The pod goes offline: the browser gets a 504, not a hang.
await podXmpp.stop();
const offline = await page.evaluate(async () => {
  const r = await x.httpFetch({ jid: POD, base: BASE, timeoutMs: 3000 })(BASE);
  return { status: r.status, cond: r.headers.get('x-xmpp-error') };
});
check(offline.status === 504, `pod offline: ${offline.status} (${offline.cond})`);

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);

await browser.close();
httpServer.close();
files.close();
storage.close();
relay.kill();
console.log(failed ? `${failed} FAILED` : 'all passed');
if (failed && prosodyErr) console.log(prosodyErr.slice(-2000));
process.exit(failed ? 1 : 0);
