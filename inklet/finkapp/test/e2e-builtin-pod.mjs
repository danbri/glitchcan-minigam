// e2e-builtin-pod.mjs — the built-in pod (FoafPods carriage 'builtin', docs/foafos-pods-20261103.md):
// a new shell has a pod in the page, chosen for apps, so Pod Notes works with no setup; with a
// session passphrase the pod is sealed into IndexedDB and opens again after a reload and UNLOCK.
//
// Needs a @factoidal/core checkout with lws/inpage.mjs:
//   FACTOIDAL=/path/to/factoidal-core/npm/factoidal node inklet/finkapp/test/e2e-builtin-pod.mjs

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, basename, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const serveRoot = resolve(repo, '..');
const FACTOIDAL = process.env.FACTOIDAL || resolve(repo, '../../factoidal-core/npm/factoidal');
if (!existsSync(join(FACTOIDAL, 'lws/inpage.mjs'))) { console.log(`SKIP no @factoidal/core with lws/inpage.mjs at ${FACTOIDAL}`); process.exit(0); }
const PORT = 18792;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHELL = `${ORIGIN}/${basename(repo)}/inklet/finkapp/?root=office&player=none&factoidal=/factoidal/`;

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };

const site = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', serveRoot], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const CONTAINER_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(CONTAINER_CHROME) ? CONTAINER_CHROME : undefined);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(executablePath ? { executablePath } : { channel: 'chrome' }) });
const cleanup = async () => { try { await browser.close(); } catch {} try { site.kill(); } catch {} };

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.route(`${ORIGIN}/factoidal/**`, async (route) => {
  const path = new URL(route.request().url()).pathname.slice('/factoidal/'.length);
  try {
    route.fulfill({ status: 200, contentType: TYPES[extname(path)] || 'application/octet-stream', body: await readFile(join(FACTOIDAL, path)) });
  } catch { route.fulfill({ status: 404, body: 'not found' }); }
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// Chat is off here: this test is about the pod, and both would load the engine.
await page.addInitScript(() => { try { localStorage.setItem('foafos.chat', JSON.stringify({ mode: 'off' })); } catch {} });

async function podNotes() {
  await page.evaluate(() => FoafOS.launchApp('podnotes'));
  let notes = null;
  for (let i = 0; i < 80 && !notes; i++) {
    notes = page.frames().find((f) => f.url().includes('/apps/podnotes/'));
    if (!notes) await page.waitForTimeout(250);
  }
  await notes.waitForFunction(() => window.__podnotes && !/Starting/.test(document.getElementById('status').textContent), null, { timeout: 180000 });
  return notes;
}
const status = (f) => f.evaluate(() => document.getElementById('status').textContent);

try {
  // ── 1. a new shell: the built-in pod is there, chosen for apps ──
  await page.goto(SHELL);
  await page.waitForFunction(() => window.FoafOS?.pods, null, { timeout: 20000 });
  const first = await page.evaluate(() => ({ apps: FoafOS.pods.appsPod(), pod: FoafOS.pods.get('browser') }));
  check(first.apps === 'browser' && first.pod?.carriage === 'builtin', `a new shell has the built-in pod for apps (${JSON.stringify(first.pod)})`);

  // ── 2. Pod Notes works with no setup ──
  let notes = await podNotes();
  const s1 = await status(notes);
  check(!/No pod is chosen/.test(s1), `Pod Notes does not ask for a pod (${s1})`);
  // The office root opens other windows over it, so the frame is driven through its own DOM.
  await notes.evaluate(() => { document.getElementById('name').value = 'hello'; document.getElementById('text').value = 'kept in this browser'; document.getElementById('save').click(); });
  await notes.waitForFunction(() => window.__podnotes.state().current?.name === 'hello' || document.getElementById('status').classList.contains('bad'), null, { timeout: 30000 });
  const saved = await notes.evaluate(() => window.__podnotes.state());
  if (saved.current?.name !== 'hello') throw new Error(`save failed: ${saved.status}`);
  check(true, 'Notes saves a note in the built-in pod');
  const st = await page.evaluate(() => ({ status: FoafOS.pods.status('browser'), kept: FoafOS.pods.get('browser').kept }));
  check(st.status === 'online' && st.kept === 'run', `the pod is online and held for this run (${JSON.stringify(st)})`);

  // The Pods window says where it is and how it is kept.
  await page.evaluate(() => FoafOS.openPods());
  const card = await page.textContent('#foafos-pods section[data-pod="browser"]');
  check(/In this browser/.test(card) && /lost when this tab closes/.test(card), 'PodStore shows the built-in pod, held for this run only');

  // ── 3. seal with a passphrase, reload, UNLOCK: the note is still there ──
  await page.evaluate(() => { document.getElementById('foafos-pass').value = 'correct horse battery'; document.getElementById('foafos-save').click(); });
  await page.waitForFunction(() => FoafOS.pods.get('browser').kept === 'sealed', null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('foafos-pods', 1);
    req.onsuccess = () => { const g = req.result.transaction('snapshots').objectStore('snapshots').get('browser'); g.onsuccess = () => resolve(JSON.stringify(g.result ?? null)); };
    req.onerror = () => resolve('null');
  }));
  check(stored !== 'null', 'sealing writes the pod to IndexedDB');
  check(!stored.includes('kept in this browser'), 'what is in IndexedDB is sealed (the note text is not in it)');

  await page.reload();
  await page.waitForFunction(() => window.FoafOS?.pods, null, { timeout: 20000 });
  notes = await podNotes();
  const s2 = await status(notes);
  check(/UNLOCK/.test(s2), `after a reload, Pod Notes asks for UNLOCK (${s2})`);
  await page.evaluate(() => { document.getElementById('foafos-pass').value = 'correct horse battery'; document.getElementById('foafos-unlock').click(); });
  await page.waitForFunction(() => FoafOS.pods.status('browser') === 'online', null, { timeout: 60000 });
  await notes.evaluate(() => window.__podnotes.refresh());
  await notes.waitForFunction(() => document.getElementById('notes').textContent.includes('hello'), null, { timeout: 10000 });
  await notes.evaluate(() => window.__podnotes.open('hello'));
  await notes.waitForFunction(() => document.getElementById('text').value === 'kept in this browser', null, { timeout: 10000 });
  check(true, 'after UNLOCK the note is there, with its text');

  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
} catch (e) {
  check(false, `exception: ${e.message}`);
} finally {
  await cleanup();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
