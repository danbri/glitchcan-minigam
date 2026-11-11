// Files: every location says where it is, and device storage works. Real Chrome and real OPFS.
// The browser's folder picker cannot be driven, so that one call is stubbed with an OPFS folder;
// everything behind it is real. Run: CHROMIUM_PATH=... FACTOIDAL=... node e2e-files-locations.mjs
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const FACTOIDAL = process.env.FACTOIDAL;
if (!FACTOIDAL) { console.error('set FACTOIDAL to an @factoidal/core folder'); process.exit(2); }
const PORT = Number(process.env.PORT) || 18793;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHELL = `${ORIGIN}/${basename(repo)}/inklet/finkapp/?root=office&app=files&player=none&factoidal=/factoidal/`;

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };
const site = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', dirname(repo)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const CONTAINER_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(CONTAINER_CHROME) ? CONTAINER_CHROME : undefined);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(executablePath ? { executablePath } : {}) });
const cleanup = async () => { try { await browser.close(); } catch {} try { site.kill(); } catch {} };

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
await context.route(`${ORIGIN}/factoidal/**`, async (route) => {
  const path = new URL(route.request().url()).pathname.slice('/factoidal/'.length);
  try { route.fulfill({ status: 200, contentType: TYPES[extname(path)] || 'application/octet-stream', body: readFileSync(join(FACTOIDAL, path)) }); }
  catch { route.fulfill({ status: 404, body: '' }); }
});
await context.addInitScript(() => {
  if (window.top !== window) return;
  window.showDirectoryPicker = async () => {
    const top = await navigator.storage.getDirectory();
    const d = await top.getDirectoryHandle('picked-folder', { create: true });
    if (!d.queryPermission) { d.queryPermission = async () => 'granted'; d.requestPermission = async () => 'granted'; }
    return d;
  };
});

const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/serviceWorker/.test(e.message)) errors.push(e.message); });
const filesFrame = async (p) => {
  for (let i = 0; i < 80; i++) {
    const f = p.frames().find((x) => x.url().includes('apps/files/'));
    if (f && await f.evaluate(() => !!window.__files?.state().locations.length).catch(() => false)) return f;
    await p.waitForTimeout(250);
  }
  throw new Error('Files never listed its locations');
};
const state = (f) => f.evaluate(() => { const s = window.__files.state(); return { current: s.current, status: s.status, ids: s.locations.map((l) => l.id), items: s.items.map((i) => i.path), where: document.getElementById('where').textContent }; });

try {
  const first = await page.goto(SHELL);
  // another server already on PORT answers instead of ours (our python3 then fails to bind, silently)
  if (!first || first.status() !== 200) throw new Error(`the shell did not load (HTTP ${first?.status()}): is another server on port ${PORT}? Set PORT`);
  let f = await filesFrame(page);
  let s = await state(f);
  check(s.ids.includes('device') && s.ids.includes('browser'), `locations listed: ${s.ids.join(', ')}`);
  check(/Where/.test(s.where) && /Needs/.test(s.where) && /Encrypted/.test(s.where) && /Could lose it/.test(s.where), 'the current location says where it is, what it needs, whether it is encrypted and what could lose it');
  check(/memory only|encrypted/.test(s.where), 'the built-in pod says how it is kept');

  await f.evaluate(() => window.__files.useLocation('device'));
  s = await state(f);
  check(s.current === 'device', `switched to This device (${s.status || 'no error'})`);
  check(/Finder and Explorer cannot show/.test(s.where), 'This device says Finder cannot show its files');
  const wrote = await f.evaluate(() => foaf.pod.put('notes/hello.txt', 'kept on this device', { contentType: 'text/plain' }));
  check(wrote.ok, `a file is written through the pod verbs (${wrote.status ?? wrote.reason})`);
  const onDisk = await page.evaluate(async () => {
    const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('foafos')).getDirectoryHandle('notes');
    return (await (await d.getFileHandle('hello.txt')).getFile()).text();
  });
  check(onDisk === 'kept on this device', 'the file is really in OPFS');
  const stale = await f.evaluate(async () => {
    const a = await foaf.pod.get('notes/hello.txt');
    await foaf.pod.put('notes/hello.txt', 'second', { contentType: 'text/plain', etag: a.etag });
    return foaf.pod.put('notes/hello.txt', 'third', { contentType: 'text/plain', etag: a.etag });
  });
  check(stale.reason === 'conflict', `a stale save is refused (${stale.reason})`);

  await page.reload();
  f = await filesFrame(page);
  s = await state(f);
  check(s.current === 'device', 'the location is remembered after a reload');
  await f.waitForFunction(() => window.__files.state().items.length > 0, null, { timeout: 10000 }).catch(() => {});
  s = await state(f);
  const after = await f.evaluate(() => foaf.pod.get('notes/hello.txt'));
  check(after.body === 'second', `the file survives a reload (${after.body ?? after.reason})`);
  check(s.items.includes('notes/'), `the list shows the folder (${s.items.join(', ')})`);
  // Type-ahead: letters typed in the list jump to the first name that starts with them.
  await f.evaluate(() => Promise.all(['apple.txt', 'avocado.txt'].map((n) => foaf.pod.put(`notes/${n}`, n, { contentType: 'text/plain' }))));
  await f.evaluate(() => window.__files.go('notes/'));
  await f.waitForFunction(() => document.querySelectorAll('#items tbody tr').length >= 3, null, { timeout: 5000 }).catch(() => {});
  await f.focus('#items tbody tr');
  await f.press('#items tbody tr', 'h');
  const toH = await f.evaluate(() => document.activeElement?.dataset?.path);
  await page.waitForTimeout(900);              // a pause starts a new name
  await page.keyboard.press('a'); await page.keyboard.press('v');
  const toAv = await f.evaluate(() => document.activeElement?.dataset?.path);
  check(toH === 'notes/hello.txt' && toAv === 'notes/avocado.txt', `typing a name jumps to it (${toH}, ${toAv})`);
  // From the filter, Enter opens the top match and Down moves into the list.
  const filt = (v) => f.evaluate((x) => { const i = document.getElementById('filter'); i.value = x; i.dispatchEvent(new Event('input')); }, v);
  const narrow = await f.evaluate(() => ({ filter: !!document.getElementById('filter').offsetParent, wide: document.body.clientWidth > 620, crumbs: document.querySelector('#crumbs li:last-child button')?.offsetWidth > 0 }));
  check(narrow.wide || (narrow.filter && narrow.crumbs), `a narrow window keeps the filter and the folder name (${JSON.stringify(narrow)})`);
  await filt('avo');
  await f.focus('#filter'); await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const opened = await f.evaluate(() => window.__files.state().picked?.path);
  await filt('app');
  await f.focus('#filter'); await page.keyboard.press('ArrowDown');
  const down = await f.evaluate(() => document.activeElement?.dataset?.path);
  check(opened === 'notes/avocado.txt' && down === 'notes/apple.txt', `the filter's Enter opens the top match, Down enters the list (${opened}, ${down})`);
  await filt('');
  await f.evaluate(() => Promise.all(['apple.txt', 'avocado.txt'].map((n) => foaf.pod.delete?.(`notes/${n}`))));
  await f.evaluate(() => window.__files.go(''));

  await page.screenshot({ path: process.env.SHOT || '/dev/null' }).catch(() => {});
  await f.click('#change-location');
  await page.waitForTimeout(300);
  await f.click('#add-folder');
  await page.waitForTimeout(800);
  s = await state(f);
  check(s.current?.startsWith('folder-'), `a chosen folder becomes a location (${s.current}, ${s.status || 'no error'})`);
  check(/You can open it in Finder/.test(s.where), 'the folder says Finder can show it');
  const folderWrite = await f.evaluate(() => foaf.pod.put('in-folder.txt', 'hi', { contentType: 'text/plain' }));
  const inFolder = await page.evaluate(async () => (await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('picked-folder')).getFileHandle('in-folder.txt')).getFile()).text());
  check(folderWrite.ok && inFolder === 'hi', 'a file lands in the chosen folder');
  await page.reload();
  f = await filesFrame(page);
  await f.waitForFunction(() => window.__files.state().items.length > 0, null, { timeout: 10000 }).catch(() => {});
  s = await state(f);
  check(s.current?.startsWith('folder-') && s.items.includes('in-folder.txt'), `the folder comes back after a reload (${s.items.join(', ')})`);

  // Open with: Notes gets this one file, in this one window, and nothing else.
  await f.evaluate(() => foaf.pod.put('other.txt', 'not shared', { contentType: 'text/plain' }));
  await f.evaluate(() => window.__files.pick({ path: 'in-folder.txt' }));
  await f.waitForSelector('.open-with button', { timeout: 8000 });
  const offer = await f.evaluate(() => ({ button: document.querySelector('.open-with button').textContent, comment: document.querySelector('.open-with-comment')?.textContent }));
  check(offer.button === 'Open in Notes' && /Markdown opens as its source/.test(offer.comment || ''), `Files offers Notes, with its comment (${offer.button})`);
  await f.click('.open-with button');
  let editor = null;
  for (let i = 0; i < 40 && !editor; i++) {
    for (const x of page.frames()) if (/apps\/podnotes\//.test(x.url()) && await x.evaluate(() => !!window.__podnotes?.state().shared).catch(() => false)) editor = x;
    if (!editor) await page.waitForTimeout(200);
  }
  check(!!editor, 'Notes opens on the file');
  if (editor) {
    const opened = await editor.evaluate(() => ({ text: document.getElementById('text').value, name: document.getElementById('name').value, locked: document.getElementById('name').readOnly }));
    check(opened.text === 'hi' && opened.name === 'in-folder.txt' && opened.locked, `Notes shows the file (${JSON.stringify(opened)})`);
    const token = await editor.evaluate(async () => {
      document.getElementById('text').value = 'edited in Notes';
      await window.__podnotes.save();
      return window.__podnotes.state().shared.token;
    });
    const saved = await f.evaluate(() => foaf.pod.get('in-folder.txt'));
    check(saved.body === 'edited in Notes', `saving in Notes writes the file in the folder (${saved.body})`);
    const reach = await editor.evaluate(async (share) => ({
      via: (await foaf.pod.get('other.txt', { share })).body,
      own: (await foaf.pod.get('../../other.txt')).ok,
      del: (await foaf.pod.delete('', { share })).reason,
    }), token);
    check(reach.via === 'edited in Notes' && reach.own === false && reach.del === 'denied', `the share reaches only that file (${JSON.stringify(reach)})`);
    const failedLoad = await editor.evaluate(async () => {
      const get = foaf.pod.get;
      foaf.pod.get = async () => ({ ok: false, reason: 'offline' });
      document.getElementById('reload').click();
      await new Promise((r) => setTimeout(r, 200));
      foaf.pod.get = get;
      const out = { save: document.getElementById('save').disabled, text: document.getElementById('text').readOnly };
      document.getElementById('reload').click();
      await new Promise((r) => setTimeout(r, 300));
      return { ...out, back: !document.getElementById('save').disabled };
    });
    check(failedLoad.save && failedLoad.text && failedLoad.back, `a shared file that fails to load cannot be saved over (${JSON.stringify(failedLoad)})`);
    const md = await f.evaluate(async () => { await foaf.pod.put('kept.md', '# hi', { contentType: 'text/markdown' }); return (await foaf.pod.get('kept.md')).contentType; });
    const switched = await editor.evaluate(async () => {
      await window.__podnotes.save();
      await foaf.pod.put('notes/mine.txt', 'my own note', { contentType: 'text/plain' });
      await window.__podnotes.open('mine');
      await window.__podnotes.save();
      return { shared: window.__podnotes.state().shared, locked: document.getElementById('name').readOnly };
    });
    const still = await f.evaluate(() => foaf.pod.get('in-folder.txt'));
    check(switched.shared === null && !switched.locked && still.body === 'edited in Notes', `picking a note leaves the shared file alone (${still.body})`);
    check(/markdown/.test(md), `a Markdown file reports its type (${md})`);
    await f.evaluate(() => window.__files.pick({ path: 'kept.md' }));
    await f.waitForFunction(() => /kept\.md/.test(document.querySelector('.detail-head')?.textContent || '') && !!document.querySelector('.open-with button'), null, { timeout: 8000 });
    await f.evaluate(() => document.querySelector('.open-with button').click());   // Notes' first window may cover Files here
    let mdEditor = null;
    for (let i = 0; i < 40 && !mdEditor; i++) {
      for (const x of page.frames()) if (/apps\/podnotes\//.test(x.url()) && await x.evaluate(() => window.__podnotes?.state().shared?.name === 'kept.md').catch(() => false)) mdEditor = x;
      if (!mdEditor) await page.waitForTimeout(200);
    }
    await mdEditor.evaluate(async () => { document.getElementById('text').value = '# edited'; await window.__podnotes.save(); });
    const kept = await f.evaluate(() => foaf.pod.get('kept.md'));
    check(kept.body === '# edited' && /markdown/.test(kept.contentType), `saving in Notes keeps the file's type (${kept.contentType})`);
    await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].filter((w) => w.querySelector('iframe')?.src.includes('podnotes')).at(-1).querySelector('[aria-label^="Close"]').click());
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => FoafOS.pods.shares.size);
    await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].filter((w) => w.querySelector('iframe')?.src.includes('podnotes')).at(-1).querySelector('[aria-label^="Close"]').click());
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => FoafOS.pods.shares.size);
    check(before === 1 && after === 0, `closing the window ends the share (${before} then ${after})`);
  }
  const notText = await f.evaluate(() => foaf.pod.openWith('podnotes', 'photo.png', 'image/png'));
  check(notText.reason === 'denied', `an app is not opened on a file it does not handle (${notText.reason})`);

  const denied = await page.evaluate(async () => {
    await FoafOS.launchApp('podnotes');
    return true;
  });
  await page.waitForTimeout(1500);
  const notes = page.frames().find((x) => /podnotes/.test(x.url()));
  const other = notes ? await notes.evaluate(() => Promise.all([foaf.pod.locations(), foaf.pod.use('device'), foaf.pod.addFolder()])) : null;
  check(denied && other?.every((r) => r.ok === false && r.reason === 'denied'), `an ordinary app cannot list or switch locations (${other?.map((r) => r.reason)})`);
  check(!errors.length, `no page errors (${errors.slice(0, 2).join(' | ').slice(0, 160)})`);
} catch (e) { check(false, `exception: ${e.message.slice(0, 300)}`); }
await cleanup();
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
