// e2e-local-lws-auth.mjs — the shell signs in to the foafos-stack file storage as its own did:key
// agent (docs/foafos-local-lws-auth-20261107.md). The real path: foafos-stack lws-setup and start lws
// on a private state folder and spare ports; the shell makes its key, waits for the grant, foafos-stack
// lws-allow grants it, and then an app reads, writes and lists through FoafPods. Headless only.
//
//   CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node inklet/finkapp/test/e2e-local-lws-auth.mjs
//
// Uses the @factoidal/core behind the `factoidal` command (FACTOIDAL=/path overrides), served
// same-origin with ?factoidal=, so no CDN is needed.

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, basename, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const serveRoot = resolve(repo, '..');
const FACTOIDAL = process.env.FACTOIDAL || (() => { const b = spawnSync('which', ['factoidal'], { encoding: 'utf8' }).stdout.trim(); return b ? dirname(dirname(realpathSync(b))) : ''; })();
if (!existsSync(join(FACTOIDAL, 'lws/client.mjs'))) { console.log(`SKIP no @factoidal/core with lws/client.mjs at ${FACTOIDAL}`); process.exit(0); }
const PORT = 21000 + Math.floor(Math.random() * 8000);
const LWS_PORT = PORT + 1;
const ORIGIN = `http://localhost:${PORT}`;   // the stack's lws answers CORS for http://localhost:<shell port>
const SHELL = `${ORIGIN}/${basename(repo)}/inklet/finkapp/?root=office&player=none&factoidal=/factoidal/`;
const BASE = `http://127.0.0.1:${LWS_PORT}/`;
const T = mkdtempSync(join(tmpdir(), 'e2e-lws-auth-'));
const STACK = join(repo, 'inklet/tools/foafos-stack.mjs');
const ENV = { ...process.env, NO_COLOR: '1', FOAFOS_STACK_HOME: join(T, 'state'), FOAFOS_LWS_DIR: join(T, 'lws'), FOAFOS_LWS_PORT: String(LWS_PORT), FOAFOS_SHELL_PORT: String(PORT) };
delete ENV.FOAFOS_LWS_AUTH; delete ENV.FOAFOS_LWS_INSECURE_NO_AUTH;
const stack = (...args) => { const r = spawnSync('node', [STACK, ...args], { env: ENV, encoding: 'utf8', timeout: 60000 }); return { code: r.status, out: r.stdout + r.stderr }; };

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };

const setup = stack('lws-setup');
check(setup.code === 0, 'foafos-stack lws-setup on a new storage');
const started = stack('start', 'lws');
check(started.code === 0, `foafos-stack start lws (${started.out.trim().split('\n').pop()})`);

const site = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', serveRoot], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const CONTAINER_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(CONTAINER_CHROME) ? CONTAINER_CHROME : undefined);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(executablePath ? { executablePath } : { channel: 'chrome' }) });
const cleanup = async () => {
  try { await browser.close(); } catch {}
  try { site.kill(); } catch {}
  stack('stop', 'lws');
  rmSync(T, { recursive: true, force: true });
};

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.route(`${ORIGIN}/factoidal/**`, async (route) => {
  const path = new URL(route.request().url()).pathname.slice('/factoidal/'.length);
  try { route.fulfill({ status: 200, contentType: TYPES[extname(path)] || 'application/octet-stream', body: await readFile(join(FACTOIDAL, path)) }); }
  catch { route.fulfill({ status: 404, body: 'not found' }); }
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('foafos.chat', JSON.stringify({ mode: 'off' })); } catch {} });

try {
  await page.goto(SHELL);
  await page.waitForFunction(() => window.FoafOS?.pods, null, { timeout: 30000 });

  // 1. A new did:key pod: the shell makes its agent and waits for the grant.
  const first = await page.evaluate(async (base) => {
    FoafOS.pods.add({ id: 'laptop', label: 'This computer', carriage: 'https', base, auth: 'did-key' });
    return FoafOS.pods.connect('laptop', { ask: true });
  }, BASE);
  check(first.status === 'needs-ok' && /^did:key:z/.test(first.agent || ''), `the storage refuses this browser until it is let in (${first.status}, ${first.detail})`);
  check(first.detail.includes(`foafos-stack lws-allow ${first.agent}`), 'and says which command lets it in');
  check(!/"d":/.test(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))), 'no private key in localStorage');

  // 2. The owner lets it in, with foafos-stack.
  const allow = stack('lws-allow', first.agent, '--label', 'e2e browser');
  check(allow.code === 0, `foafos-stack lws-allow (${allow.out.trim()})`);

  // 3. Connected: an app reads, writes and lists through the shell.
  const after = await page.evaluate(async () => {
    const p = await FoafOS.pods.connect('laptop', { ask: true });
    FoafOS.pods.grant('e2e-app', { 'pod:read': { pod: 'laptop' }, 'pod:write': { pod: 'laptop' } });
    const put = await FoafOS.pods.invoke('e2e-app', 'pod.put', { path: 'hello.txt', body: 'written by the shell', contentType: 'text/plain' });
    const get = await FoafOS.pods.invoke('e2e-app', 'pod.get', { path: 'hello.txt' });
    const list = await FoafOS.pods.invoke('e2e-app', 'pod.list', { path: '' });
    return { status: p.status, put, get, list };
  });
  check(after.status === 'online', `online after the grant (${after.status})`);
  check(after.put.ok, `write (${JSON.stringify(after.put)})`);
  check(after.get.ok && after.get.body === 'written by the shell', `read (${after.get.body})`);
  check(after.list.ok && JSON.stringify(after.list.items).includes('hello.txt'), `list (${JSON.stringify(after.list.items)})`);

  // 4. The same request with no token is refused: the data is the ACL's, not the port's.
  const anon = await fetch(`${BASE}apps/e2e-app/hello.txt`);
  check(anon.status === 401, `no token: ${anon.status}`);

  // 5. Revoked: the shell is refused again.
  stack('lws-revoke', first.agent);
  const revoked = await page.evaluate(() => FoafOS.pods.connect('laptop', { ask: true }));
  check(revoked.status === 'needs-ok', `revoked: ${revoked.status}`);
  check(!errors.length, `no page errors (${errors.join('; ')})`);
} catch (e) {
  check(false, `threw: ${e.message}`);
} finally {
  await cleanup();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
