#!/usr/bin/env node
// The foafos apps demo (?root=apps), end to end: the owner's scenario of
// three spreadsheets and two stories open, both stories using one Playlist.
//   · boot opens three Data windows on three documents and two runners
//   · each Data window writes to its own store (sheets#<doc>)
//   · the first story's `# APP: playlist then=go action=queue` opens the
//     Playlist; the second story's request finds it and adds to its queue
//   · a launch from the app list shows the same Playlist (one node)
//   · a dream in the first story: depth frame and words, the outer session
//     suspended, the Playlist (a child of the root) awake
//   · closing the first story's window leaves the Playlist open
// Landing page: magpie/miniapps/index.html. Design: docs/foafos-apps-20261022.md.
//
//   node inklet/finkapp/test/e2e-apps-demo.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8163;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CORS_SERVER = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', ${PORT}),
    functools.partial(H, directory='${serveRoot}')).serve_forever()
`;
const server = spawn('python3', ['-c', CORS_SERVER], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

const fail = (m) => { console.error('✖', m); process.exitCode = 1; };
const pass = (m) => console.log('✔', m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 30000) {
  for (let t = 0; t < ms; t += 250) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await wait(250);
  }
  return null;
}
const chooseText = (r, re) => r.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const i = window.__storyrunner.state.choices.findIndex((c) => rx.test(c));
  if (i >= 0) window.__storyrunner.choose(i);
  return i;
}, re.source);
const proseHas = (r, text) => until(() => r.evaluate(
  (t) => window.__storyrunner.state.prose.some((p) => p.text.includes(t)), text));

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?root=apps`);

  // ── boot: three Data windows on three documents, two runners ─────────
  const wins = await until(async () => {
    const w = await page.evaluate(() => [...document.querySelectorAll('.foafos-window')]
      .map((el) => ({ app: el.dataset.appId, doc: el.dataset.doc || null, story: el.dataset.story || null })));
    return w.length >= 5 && w;
  });
  const docs = (wins || []).filter((w) => w.app === 'sheets').map((w) => w.doc).sort();
  const stories = (wins || []).filter((w) => w.app === 'storyrunner').map((w) => w.story.split('/').pop()).sort();
  JSON.stringify(docs) === '["budget","reading","trips"]'
    && JSON.stringify(stories) === '["first-story.fink.js","second-story.fink.js"]'
    ? pass('boot: three Data windows (budget, trips, reading) and two story runners')
    : fail(`boot windows: ${JSON.stringify(wins)}`);

  // ── each Data window writes to its own store ──────────────────────────
  const sheetFrames = await until(async () => {
    const out = [];
    for (const el of await page.$$('.foafos-window[data-app-id="sheets"]')) {
      const f = await (await el.$('iframe'))?.contentFrame();
      const doc = await el.getAttribute('data-doc');
      if (!f || !(await f.evaluate(() => !!window.foaf?.ready).catch(() => false))) return null;
      out.push({ f, doc });
    }
    return out.length === 3 && out;
  }, 60000);
  if (!sheetFrames) fail('the Data windows never spoke the app protocol');
  else {
    for (const { f, doc } of sheetFrames) await f.evaluate((d) => localStorage.setItem('demo.doc', d), doc);
    await wait(300);
    const stores = await page.evaluate(() => Object.fromEntries(['budget', 'trips', 'reading']
      .map((d) => [d, FoafOS.store.backend.read(`sheets#${d}`)['demo.doc'] || null])
      .concat([['app', FoafOS.store.backend.read('sheets')['demo.doc'] || null]])));
    stores.budget === 'budget' && stores.trips === 'trips' && stores.reading === 'reading' && stores.app === null
      ? pass('each Data window wrote to its own store (sheets#budget, sheets#trips, sheets#reading)')
      : fail(`stores: ${JSON.stringify(stores)}`);
  }

  // ── the two stories ───────────────────────────────────────────────────
  const runners = await until(async () => {
    const out = {};
    for (const f of page.frames().filter((x) => /apps\/storyrunner\/index\.html/.test(x.url()))) {
      const ok = await f.evaluate(() => window.__storyrunner?.ready?.() && window.__storyrunner.state.choices.length > 0).catch(() => false);
      if (!ok) return null;
      const url = await f.evaluate(() => window.__storyrunner.state.storyUrl);
      out[/first-story/.test(url) ? 'first' : 'second'] = f;
    }
    return out.first && out.second && out;
  }, 60000);
  if (!runners) throw new Error('the two story runners never became ready');
  const { first, second } = runners;
  const playlistNodes = () => page.evaluate(() => [...FoafOS.apps.nodes.values()]
    .filter((n) => n.appId === 'playlist').map((n) => ({ id: n.id, parentId: n.parentId, suspended: n.suspended })));
  const playlistFrame = () => page.frames().find((f) => /apps\/playlist\/index\.html/.test(f.url()));

  (await playlistNodes()).length === 0 ? pass('no Playlist before a story asks for one')
    : fail('a Playlist was open at boot');

  (await chooseText(first, /Quiet Engines/)) >= 0 || fail('no queue choice in the first story');
  await proseHas(first, 'asked the Playlist to add');
  const q1 = await until(async () => {
    const f = playlistFrame();
    const q = f && await f.evaluate(() => window.__playlist?.queue?.()).catch(() => null);
    return q && q.length >= 1 && q;
  });
  const root = await page.evaluate(() => FoafOS.rootNode.id);
  const n1 = await playlistNodes();
  q1 && q1[0].id === 'the-quiet-engines' && q1[0].from === 'first story' && n1.length === 1 && n1[0].parentId === root
    ? pass('the first story opened the Playlist (a child of the root) and queued "The Quiet Engines"')
    : fail(`first queue: ${JSON.stringify({ q1, n1, root })}`);
  const stillReading = await first.evaluate(() => !window.__storyrunner.paused() && window.__storyrunner.state.choices.length > 0);
  stillReading ? pass('the first story went on at once (then=go does not wait)') : fail('the first story waited');

  (await chooseText(second, /Euston Night Mail/)) >= 0 || fail('no queue choice in the second story');
  await proseHas(second, 'asked the Playlist to add');
  const q2 = await until(async () => {
    const q = await playlistFrame()?.evaluate(() => window.__playlist.queue()).catch(() => null);
    return q && q.length >= 2 && q;
  });
  const n2 = await playlistNodes();
  q2 && q2[1].id === 'per-station/euston-night-mail-remastered' && q2[1].from === 'second story' && n2.length === 1
    ? pass('the second story added to the same Playlist: one node, two tracks, each with its story')
    : fail(`second queue: ${JSON.stringify({ q2, n2 })}`);

  await page.evaluate(() => FoafOS.launchApp('playlist'));
  await wait(400);
  const n3 = await playlistNodes();
  const frames = page.frames().filter((f) => /apps\/playlist\/index\.html/.test(f.url())).length;
  n3.length === 1 && frames === 1
    ? pass('a launch from the app list shows the same Playlist (one node, one frame)')
    : fail(`second launch: ${JSON.stringify({ n3, frames })}`);

  const refused = await second.evaluate(() => window.foaf.storyRequest('story.app',
    { app: 'playlist', action: 'erase', args: {} }));
  refused?.ok === false && refused.reason === 'unknown-action'
    ? pass('an action the manifest does not list is refused ("unknown-action")')
    : fail(`unlisted action: ${JSON.stringify(refused)}`);

  // ── a story inside the first story ────────────────────────────────────
  (await chooseText(first, /inside this one/)) >= 0 || fail('no dream choice');
  await proseHas(first, 'Everything is paper');
  await wait(300);
  const dream = await first.evaluate(() => ({
    mark: document.getElementById('depth-mark').textContent,
    rings: getComputedStyle(document.body, '::after').boxShadow,
  }));
  const tree = await page.evaluate(() => [...FoafOS.apps.nodes.values()]
    .filter((n) => n.appId === 'story-session').map((n) => ({ label: n.label, suspended: n.suspended, dreamOf: !!n.dreamOf })));
  const outer = tree.find((n) => n.label === 'first story');
  const inner = tree.find((n) => n.dreamOf);
  const pl = await playlistNodes();
  dream.mark === 'Inside 1 story: first story' && /inset/.test(dream.rings)
    && outer?.suspended === true && inner?.suspended === false && pl[0]?.suspended === false
    ? pass('in the inner story: a frame and "Inside 1 story: first story"; the first story suspended; the Playlist awake')
    : fail(`dream: ${JSON.stringify({ dream, tree, pl })}`);
  (await chooseText(first, /fly/)) >= 0 || fail('no Fly choice');
  await proseHas(first, 'Back in the first story');
  const after = await page.evaluate(() => [...FoafOS.apps.nodes.values()]
    .filter((n) => n.appId === 'story-session').map((n) => ({ label: n.label, suspended: n.suspended })));
  after.find((n) => n.label === 'first story')?.suspended === false && after.length === 2
    ? pass('back from the inner story: the first story resumed')
    : fail(`after the dream: ${JSON.stringify(after)}`);

  // ── closing a story does not close the shared Playlist ────────────────
  await page.evaluate(() => {
    const win = [...document.querySelectorAll('.foafos-window[data-app-id="storyrunner"]')]
      .find((w) => /first-story/.test(w.dataset.story || ''));
    FoafOS.apps.close(win.dataset.instance);
  });
  await wait(1500);
  const left = await playlistNodes();
  left.length === 1 ? pass('the first story closed; the Playlist stays open for the second')
    : fail(`after closing the first story: ${JSON.stringify(left)}`);

  pageErrors.length === 0 ? pass('no page errors') : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nAPPS DEMO E2E: FAIL' : '\nAPPS DEMO E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nAPPS DEMO E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
