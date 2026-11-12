// Files: every location says where it is, and device storage works. Real Chrome and real OPFS.
// The browser's folder picker cannot be driven, so that one call is stubbed with an OPFS folder;
// everything behind it is real. Run: CHROMIUM_PATH=... FACTOIDAL=... node e2e-files-locations.mjs
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { makeZip } from '../../../packages/foafos/test/zip-fixture.mjs';
import { jpeg as fixtureJpeg, CAMERA } from '../../../packages/foafos/test/meta-fixture.mjs';
import { readFileSync as readAgi } from 'node:fs';
const MD2HTML_WASM = [...readAgi(new URL('../../../packages/foafos/agi/md2html.wasm', import.meta.url))];

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
  const builtinBytes = await f.evaluate(async () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    const put = await foafos.pod.put('bin/all-bytes.bin', bytes.buffer, { contentType: 'application/octet-stream' });
    const got = await foafos.pod.get('bin/all-bytes.bin', { as: 'bytes' });
    await foafos.pod.delete('bin/all-bytes.bin');
    return { put: put.ok, same: got.ok && got.body.byteLength === 256 && new Uint8Array(got.body).every((v, i) => v === i) };
  });
  check(builtinBytes.put && builtinBytes.same, `the built-in pod keeps all 256 byte values (${JSON.stringify(builtinBytes)})`);

  // A build handler, approved in System by the person, turns a saved Markdown file into a page.
  await f.evaluate(async (wasm) => {
    await foafos.pod.put('agi-bin/md2html.json', JSON.stringify({ match: 'notes/**/*.md', outputDir: 'site/', output: 'site/{dir}{name}.html', description: 'Markdown to a web page' }), { contentType: 'application/json' });
    await foafos.pod.put('agi-bin/md2html.wasm', new Uint8Array(wasm).buffer, { contentType: 'application/wasm' });
    await foafos.pod.put('notes/before.md', '# Before approval', { contentType: 'text/markdown' });
  }, MD2HTML_WASM);
  await page.evaluate(() => FoafOS.pods.agiIdle());
  const unapproved = await f.evaluate(async () => (await foafos.pod.get('site/notes/before.html')).ok);
  await page.evaluate(() => FoafOS.openSystem?.());
  await page.waitForTimeout(400);
  await page.evaluate(() => [...document.querySelectorAll('#foafos-session-win button, #foafos-session-win [role=tab]')].find((b) => /^Pods$/.test(b.textContent.trim()))?.click());
  await page.waitForTimeout(400);
  const approveShown = await page.evaluate(async () => {
    const box = [...document.querySelectorAll('details.fp-agi')].find((d) => d.closest('.fp-pod')?.querySelector('.fp-dot'));
    if (!box) return 'no panel';
    box.open = true;
    for (let i = 0; i < 30 && !box.querySelector('.fp-agi-row'); i++) await new Promise((r) => setTimeout(r, 100));
    const row = box.querySelector('.fp-agi-row[data-handler="md2html"]');
    const btn = [...(row?.querySelectorAll('button') || [])].find((b) => b.textContent === 'Approve');
    if (!btn) return row ? row.textContent : 'no row';
    btn.click();
    await new Promise((r) => setTimeout(r, 400));
    return 'clicked';
  });
  const built = await f.evaluate(async () => {
    await foafos.pod.put('notes/trip.md', '# Trip\n\nBy *boat*, <b>not</b> bus.', { contentType: 'text/markdown' });
    return true;
  });
  await page.evaluate(() => FoafOS.pods.agiIdle());
  const html = await f.evaluate(async () => (await foafos.pod.get('site/notes/trip.html')).body || '');
  check(!unapproved && approveShown === 'clicked' && built && /<h1>Trip<\/h1>/.test(html) && /By <em>boat<\/em>, &lt;b&gt;not&lt;\/b&gt; bus\./.test(html),
    `an approved build handler makes a page from a saved Markdown file (${JSON.stringify({ unapproved, approveShown, html: html.slice(0, 160) })})`);

  await f.evaluate(() => window.__files.useLocation('device'));
  s = await state(f);
  check(s.current === 'device', `switched to This device (${s.status || 'no error'})`);
  check(/Finder and Explorer cannot show/.test(s.where), 'This device says Finder cannot show its files');
  const wrote = await f.evaluate(() => foafos.pod.put('notes/hello.txt', 'kept on this device', { contentType: 'text/plain' }));
  check(wrote.ok, `a file is written through the pod verbs (${wrote.status ?? wrote.reason})`);
  const onDisk = await page.evaluate(async () => {
    const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('foafos')).getDirectoryHandle('notes');
    return (await (await d.getFileHandle('hello.txt')).getFile()).text();
  });
  check(onDisk === 'kept on this device', 'the file is really in OPFS');
  const stale = await f.evaluate(async () => {
    const a = await foafos.pod.get('notes/hello.txt');
    await foafos.pod.put('notes/hello.txt', 'second', { contentType: 'text/plain', etag: a.etag });
    return foafos.pod.put('notes/hello.txt', 'third', { contentType: 'text/plain', etag: a.etag });
  });
  check(stale.reason === 'conflict', `a stale save is refused (${stale.reason})`);

  await f.click('#view');                     // icons, kept across the reload below
  await page.reload();
  f = await filesFrame(page);
  s = await state(f);
  check(s.current === 'device', 'the location is remembered after a reload');
  await f.waitForFunction(() => window.__files.state().items.length > 0, null, { timeout: 10000 }).catch(() => {});
  const keptIcons = await f.evaluate(() => ({ grid: !!document.querySelector('#items .grid'), pressed: document.getElementById('view').getAttribute('aria-pressed') }));
  check(keptIcons.grid && keptIcons.pressed === 'true', `the icon view is remembered after a reload (${JSON.stringify(keptIcons)})`);
  await f.click('#view');                     // back to the list for the checks that follow
  await f.waitForFunction(() => window.__files.state().items.length > 0, null, { timeout: 10000 }).catch(() => {});
  s = await state(f);
  const after = await f.evaluate(() => foafos.pod.get('notes/hello.txt'));
  check(after.body === 'second', `the file survives a reload (${after.body ?? after.reason})`);
  check(s.items.includes('notes/'), `the list shows the folder (${s.items.join(', ')})`);
  // Keys: Backspace goes up a folder and lands on the folder you came from.
  await f.evaluate(() => window.__files.go('notes/'));
  await f.waitForFunction(() => document.querySelector('#items tbody tr'), null, { timeout: 5000 }).catch(() => {});
  await f.focus('#items tbody tr');
  await f.press('#items tbody tr', 'Backspace');
  await page.waitForTimeout(400);
  const up = await f.evaluate(() => ({ folder: window.__files.state().folder, focused: document.activeElement?.dataset?.path }));
  check(up.folder === '' && up.focused === 'notes/', `Backspace goes up and lands on the folder (${JSON.stringify(up)})`);
  // Back and Forward, as in a browser: by button, by Alt+Left / Alt+Right, and a new place clears Forward.
  const where_ = () => f.evaluate(() => ({ at: window.__files.state().folder, back: document.getElementById('back').disabled, fwd: document.getElementById('forward').disabled }));
  const nav0 = await where_();
  await f.click('#back'); await page.waitForTimeout(400);
  const nav1 = await where_();
  await f.click('#forward'); await page.waitForTimeout(400);
  const nav2 = await where_();
  await f.press('#items tbody tr', 'Alt+ArrowLeft'); await page.waitForTimeout(400);
  const nav3 = await where_();
  await f.press('#items tbody tr', 'Alt+ArrowRight'); await page.waitForTimeout(400);
  const nav4 = await where_();
  await f.click('#back'); await page.waitForTimeout(400);
  await f.evaluate(() => window.__files.go('')); await page.waitForTimeout(400);
  const nav5 = await where_();
  check(nav0.at === '' && nav0.fwd && nav1.at === 'notes/' && !nav1.fwd && nav2.at === '' && nav2.fwd && nav3.at === 'notes/' && nav4.at === '' && nav5.at === '' && nav5.fwd,
    `Back and Forward, by button and Alt+arrows; a new place clears Forward (${[nav0, nav1, nav2, nav3, nav4, nav5].map((n) => `${n.at || '/'}${n.fwd ? '' : '+'}`).join(' ')})`);
  await f.press('#items tbody tr[data-path="notes/"]', 'End');
  const end = await f.evaluate(() => { const rows = [...document.querySelectorAll('#items tbody tr')]; return document.activeElement === rows.at(-1); });
  check(end, 'End goes to the last item');
  // Type-ahead: letters typed in the list jump to the first name that starts with them.
  await f.evaluate(() => Promise.all(['apple.txt', 'avocado.txt'].map((n) => foafos.pod.put(`notes/${n}`, n, { contentType: 'text/plain' }))));
  await f.evaluate(() => window.__files.go('notes/'));
  await f.waitForFunction(() => document.querySelectorAll('#items tbody tr').length >= 3, null, { timeout: 5000 }).catch(() => {});
  await f.focus('#items tbody tr');
  await f.press('#items tbody tr', 'h');
  const toH = await f.evaluate(() => document.activeElement?.dataset?.path);
  await page.waitForTimeout(900);              // a pause starts a new name
  await page.keyboard.press('a'); await page.keyboard.press('v');
  const toAv = await f.evaluate(() => document.activeElement?.dataset?.path);
  check(toH === 'notes/hello.txt' && toAv === 'notes/avocado.txt', `typing a name jumps to it (${toH}, ${toAv})`);
  const tint = await f.evaluate(() => getComputedStyle(document.activeElement.querySelector('td')).backgroundColor);
  check(!/rgba\(0, 0, 0, 0\)|transparent/.test(tint), `the row the keyboard is on is tinted (${tint})`);
  // Space shows a folder in the side panel without opening it, and the list keeps the keyboard.
  await f.evaluate(() => window.__files.go(''));
  await page.waitForTimeout(300);
  await f.focus('#items tbody tr[data-path="notes/"]');
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  const peek = await f.evaluate(() => ({ folder: window.__files.state().folder, picked: window.__files.state().picked?.path, still: document.activeElement?.dataset?.path }));
  check(peek.folder === '' && peek.picked === 'notes/' && peek.still === 'notes/', `Space shows an item without opening it (${JSON.stringify(peek)})`);
  // Delete on the focused row asks first; Escape keeps the file, Delete then Enter removes it.
  await f.evaluate(() => foafos.pod.put('notes/doomed.txt', 'x', { contentType: 'text/plain' }));
  await f.evaluate(() => window.__files.go('notes/'));
  await page.waitForTimeout(300);
  await f.focus('#items tbody tr[data-path="notes/doomed.txt"]');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(400);
  const asked = await f.evaluate(() => /Delete doomed\.txt\?/.test(document.querySelector('.ask')?.textContent || ''));
  await page.keyboard.press('Escape');
  const kept = await f.evaluate(async () => !document.querySelector('.ask') && (await foafos.pod.get('notes/doomed.txt')).ok);
  await f.focus('#items tbody tr[data-path="notes/doomed.txt"]');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(400);
  const safe = await f.evaluate(() => document.activeElement?.textContent === 'Cancel');
  await f.click('.ask button.danger');
  await page.waitForTimeout(600);
  const gone = await f.evaluate(async () => !(await foafos.pod.get('notes/doomed.txt')).ok);
  check(asked && kept && safe && gone, `Delete asks first (starting on Cancel), Escape keeps the file, the Delete button removes it (${asked}, ${kept}, ${safe}, ${gone})`);
  // Dropping files: text and a photo are added (the photo as bytes); one over 8 MiB is named and left out.
  // Picking the photo shows it, and it can be deleted.
  const dropped = await f.evaluate(async () => {
    await window.__files.go('notes/');
    const dt = new DataTransfer();
    dt.items.add(new File(['dropped text'], 'dropped.txt', { type: 'text/plain' }));
    const png1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    dt.items.add(new File([png1], 'photo.png', { type: 'image/png' }));
    dt.items.add(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'huge.bin', { type: 'application/octet-stream' }));
    const pane = document.getElementById('items-pane');
    pane.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    const lit = pane.classList.contains('dropping');
    pane.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 800));
    const got = await foafos.pod.get('notes/dropped.txt');
    const png = await foafos.pod.get('notes/photo.png', { as: 'bytes' });
    const same = png.ok && new Uint8Array(png.body).every((v, i) => v === png1[i]) && png.body.byteLength === png1.length;
    await window.__files.pick({ path: 'notes/photo.png', container: false });
    const img = document.querySelector('#detail img');
    await new Promise((r) => (img?.complete ? r() : img?.addEventListener('load', r, { once: true }) ?? r()));
    const deleteOffered = [...document.querySelectorAll('#detail button')].some((b) => b.textContent === 'Delete');
    const noNull = !/\bnull\b/.test(document.getElementById('detail').textContent);
    return { lit, body: got.body, same, shown: img?.naturalWidth === 1, deleteOffered, noNull, said: document.getElementById('status')?.textContent || '' };
  });
  check(dropped.lit && dropped.body === 'dropped text' && dropped.same && /huge\.bin/.test(dropped.said) && !/photo\.png/.test(dropped.said.split('Not added')[1] || ''),
    `dropping files adds text and a photo, and names the one too large (${JSON.stringify(dropped)})`);
  // Pasting: a screenshot (named image.png by the browser) becomes "Pasted image.png", a second
  // one "Pasted image 2.png", never over the first; copied text becomes "Pasted text.txt".
  // In a text field, paste is the field's own.
  const pasted = await f.evaluate(async () => {
    await window.__files.go('notes/');
    const png1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const paste = (fill, target = document.body) => { const dt = new DataTransfer(); fill(dt); target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); };
    const settle = () => new Promise((r) => setTimeout(r, 500));
    paste((dt) => dt.items.add(new File([png1], 'image.png', { type: 'image/png' }))); await settle();
    paste((dt) => dt.items.add(new File([png1], 'image.png', { type: 'image/png' }))); await settle();
    paste((dt) => dt.setData('text/plain', 'a line I copied')); await settle();
    const filter = document.getElementById('filter');
    const before = (await foafos.pod.list('notes/')).items.length;
    paste((dt) => dt.setData('text/plain', 'typed into the filter'), filter); await settle();
    const after = (await foafos.pod.list('notes/')).items.length;
    const one = await foafos.pod.get('notes/Pasted image.png', { as: 'bytes' }), two = await foafos.pod.get('notes/Pasted image 2.png', { as: 'bytes' }), txt = await foafos.pod.get('notes/Pasted text.txt');
    const out = { one: one.ok && one.contentType === 'image/png' && new Uint8Array(one.body).length === png1.length, two: two.ok, txt: txt.body, filterLeft: before === after, picked: window.__files.state().picked?.path ?? null };
    for (const p of ['notes/Pasted image.png', 'notes/Pasted image 2.png', 'notes/Pasted text.txt']) await foafos.pod.delete(p);
    await window.__files.go('notes/');
    return out;
  });
  check(pasted.one && pasted.two && pasted.txt === 'a line I copied' && pasted.filterLeft,
    `pasting adds a screenshot, a second beside it, and copied text; not while typing in the filter (${JSON.stringify(pasted)})`);
  // Size and Modified columns, from the listing; sorting by size puts the larger file last.
  const cols = await f.evaluate(async () => {
    await foafos.pod.put('notes/big.txt', 'x'.repeat(5000), { contentType: 'text/plain' });
    await window.__files.go('notes/');
    const heads = [...document.querySelectorAll('#items thead th')].map((t) => t.textContent.replace(/[↑↓\s]/g, ''));
    const cell = (p) => document.querySelector(`#items tbody tr[data-path="${p}"] .c-size`)?.textContent;
    const sizeBtn = [...document.querySelectorAll('#items thead button')].find((b) => /Size/.test(b.textContent));
    sizeBtn.click();
    const order = [...document.querySelectorAll('#items tbody tr')].map((r) => r.dataset.path).filter((p) => /\.(txt|png)$/.test(p));
    [...document.querySelectorAll('#items thead button')].find((b) => /Name/.test(b.textContent)).click();
    await foafos.pod.delete('notes/big.txt');
    return { heads, big: cell('notes/big.txt'), last: order.at(-1), mod: !!document.querySelector('#items tbody .c-mod')?.title };
  });
  check(cols.heads.includes('Size') && cols.heads.includes('Modified') && cols.big === '4.9 KB' && cols.last === 'notes/big.txt',
    `the list shows size and time, and sorts by size (${JSON.stringify(cols)})`);
  // Where the space goes: a treemap whose box areas follow the sizes; clicking a folder opens it.
  const space = await f.evaluate(async () => {
    const sq = window.__files.squarify([{ size: 3 }, { size: 1 }], 0, 0, 40, 10);
    const areas = sq.map((b) => Math.round(b.w * b.h));
    await foafos.pod.put('notes/space/big.txt', 'x'.repeat(3000), { contentType: 'text/plain' });
    await foafos.pod.put('notes/space/small.txt', 'x'.repeat(1000), { contentType: 'text/plain' });
    await window.__files.go('notes/');
    document.getElementById('space').click();
    for (let i = 0; i < 40 && !document.querySelector('.tm'); i++) await new Promise((r) => setTimeout(r, 100));
    const box = (n) => [...document.querySelectorAll('.tm')].find((b) => b.getAttribute('aria-label')?.startsWith(n + ','));
    const ratio = box('big.txt') && box('small.txt') ? (box('big.txt').offsetWidth * box('big.txt').offsetHeight) / (box('small.txt').offsetWidth * box('small.txt').offsetHeight) : 0;
    const note = document.querySelector('.tm-note')?.textContent || '';
    box('space').click();
    await new Promise((r) => setTimeout(r, 600));
    const into = window.__files.state().folder;
    document.getElementById('space').click();
    await Promise.all(['notes/space/big.txt', 'notes/space/small.txt'].map((x) => foafos.pod.delete(x)));
    return { areas, ratio: Math.round(ratio * 10) / 10, note, into };
  });
  check(space.areas[0] === 300 && space.areas[1] === 100 && space.ratio > 2.5 && space.ratio < 3.5 && /in \d+ files/.test(space.note) && space.into === 'notes/space/',
    `the space view sizes boxes by bytes and opens a folder on click (${JSON.stringify(space)})`);
  // A space limit on the pod: a write that would go over it is refused, and Files says why.
  const capped = await page.evaluate(async () => {
    const p = FoafOS.pods.list().find((x) => x.status === 'online' && x.carriage === 'device') || FoafOS.pods.list().find((x) => x.status === 'online');
    FoafOS.pods.update(p.id, { quota: 1 });
    return p.id;
  });
  const refused = await f.evaluate(async () => {
    const r = await foafos.pod.put('notes/over.txt', 'x'.repeat(4000), { contentType: 'text/plain' });
    return r.reason;
  });
  const usage = await page.evaluate((id) => { const p = FoafOS.pods.get(id); FoafOS.pods.update(id, { quota: null }); return p.usage; }, capped);
  check(refused === 'quota' && usage > 1, `a pod's space limit refuses a write that would go over it (${refused}, used ${usage})`);
  // The status bar says what a folder holds, and with a limit, how much room is left
  const summ = await page.evaluate((id) => { FoafOS.pods.update(id, { quota: 10 * 1024 * 1024 }); return true; }, capped);
  const said = await f.evaluate(async () => {
    await foafos.pod.put('notes/sum.txt', 'y'.repeat(2048), { contentType: 'text/plain' });   // measured on a write
    await window.__files.go('notes/');
    await new Promise((r) => setTimeout(r, 600));
    const text = document.getElementById('status').textContent;
    await foafos.pod.delete('notes/sum.txt');
    return text;
  });
  await page.evaluate((id) => FoafOS.pods.update(id, { quota: null }), capped);
  check(summ && /^\d+ items?, [\d.]+ (KB|MB|bytes), [\d.]+ MB free of 10\.0 MB$/.test(said), `the status bar sums a folder and says the room left (${said})`);
  // Search finds a word inside a file, not only in names, and shows the line it is on.
  const found = await f.evaluate(async () => {
    await foafos.pod.put('notes/trip.txt', 'Pack the blue kayak and the maps.', { contentType: 'text/plain' });
    await window.__files.go('');
    const filter = document.getElementById('filter');
    filter.value = 'kayak'; filter.dispatchEvent(new Event('input'));
    [...document.querySelectorAll('#items .empty button')].find((b) => /Search all folders/.test(b.textContent))?.click();
    for (let i = 0; i < 40 && !document.querySelector('#items tbody tr[data-path="notes/trip.txt"]'); i++) await new Promise((r) => setTimeout(r, 100));
    const row = document.querySelector('#items tbody tr[data-path="notes/trip.txt"]');
    const out = { row: !!row, hit: row?.querySelector('.hit')?.textContent || '', said: document.getElementById('status').textContent };
    // Escape in the filter clears it and goes back to the folder: no search results left.
    filter.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    out.escaped = filter.value === '' && !document.querySelector('#items .hit') && window.__files.state().folder === '';
    await foafos.pod.delete('notes/trip.txt');
    await window.__files.go('');
    return out;
  });
  check(found.row && /blue kayak/.test(found.hit) && /notes\//.test(found.hit) && /by what is in them/.test(found.said) && found.escaped,
    `search finds a word inside a file and shows the line (${JSON.stringify(found)})`);
  // An archive opens as a read-only folder: look inside, read a file, nothing can be made there.
  const zipBytes = [...makeZip([{ name: 'readme.txt', data: 'Inside the zip.' }, { name: 'docs/plan.md', data: '# Plan' }])];
  const arc = await f.evaluate(async (bytes) => {
    await foafos.pod.put('notes/box.zip', new Uint8Array(bytes).buffer, { contentType: 'application/zip' });
    await window.__files.go('notes/');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('#items tbody tr[data-path="notes/box.zip"]').click();
    await wait(400);
    const openBtn = [...document.querySelectorAll('#detail button')].find((b) => b.textContent === 'Open');
    openBtn.click();
    await wait(500);
    const st = window.__files.state();
    const names = st.items.map((i) => i.path);
    const readOnly = document.getElementById('new-file').disabled;
    await window.__files.pick({ path: 'notes/box.zip!/readme.txt', container: false });
    await wait(300);
    const text = document.querySelector('#detail textarea')?.value;
    const crumb = document.getElementById('crumbs').textContent;
    await window.__files.go('notes/');
    await foafos.pod.delete('notes/box.zip');
    return { folder: st.folder, names, readOnly, text, crumb, writable: document.getElementById('new-file').disabled === false };
  }, zipBytes);
  check(arc.folder === 'notes/box.zip!/' && arc.names.includes('notes/box.zip!/readme.txt') && arc.names.includes('notes/box.zip!/docs/')
    && arc.readOnly && arc.text === 'Inside the zip.' && /🗜 box\.zip/.test(arc.crumb) && arc.writable,
    `an archive opens as a read-only folder (${JSON.stringify(arc)})`);
  // About this file: a photo's camera, size and place, read by the shell from its EXIF.
  const photo = [...fixtureJpeg(CAMERA)];
  const about = await f.evaluate(async (bytes) => {
    await foafos.pod.put('notes/beach.jpg', new Uint8Array(bytes).buffer, { contentType: 'image/jpeg' });
    await window.__files.go('notes/');
    await window.__files.pick({ path: 'notes/beach.jpg', container: false });
    for (let i = 0; i < 30 && !document.querySelector('#detail .about'); i++) await new Promise((r) => setTimeout(r, 100));
    const rows = Object.fromEntries([...document.querySelectorAll('#detail .about-list dt')].map((dt) => [dt.textContent, dt.nextElementSibling.textContent]));
    const rdf = document.querySelector('#detail .about-rdf pre')?.textContent || '';
    await foafos.pod.delete('notes/beach.jpg');
    return { rows, rdf: /schema:ImageObject/.test(rdf) && /exif:model "Pocket 3"/.test(rdf) };
  }, photo);
  check(about.rows.Camera === 'Acme Pocket 3' && about.rows.Pixels === '640 × 480' && about.rows.Place === '51.5075, -0.1275' && about.rdf,
    `a photo shows what it says about itself (${JSON.stringify(about)})`);

  // A real JPEG (the browser's own encoder) with EXIF and GPS spliced in: stripping the place
  // leaves an image that still decodes at its full size.
  const app1 = (() => { const j = fixtureJpeg(CAMERA); const len = (j[4] << 8) | j[5]; return [...j.subarray(2, 4 + len)]; })();
  const decoded = await page.evaluate(async ({ app1, url }) => {
    const { readMetadata, withoutLocation } = await import(url);
    const c = document.createElement('canvas'); c.width = 96; c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#3a7'; g.fillRect(0, 0, 96, 64); g.fillStyle = '#fc0'; g.fillRect(20, 10, 30, 30);
    const real = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
    const withExif = new Uint8Array(real.length + app1.length);
    withExif.set(real.subarray(0, 2)); withExif.set(app1, 2); withExif.set(real.subarray(2), 2 + app1.length);
    const stripped = withoutLocation(withExif);
    const bmp = await createImageBitmap(new Blob([stripped], { type: 'image/jpeg' }));
    return { had: !!readMetadata(withExif).location, left: readMetadata(stripped).location, w: bmp.width, h: bmp.height, model: readMetadata(stripped).fields.model };
  }, { app1, url: new URL('../../packages/foafos/src/metadata.mjs', page.url()).href });
  // Orientation 6 (turn 90°) is kept and the browser honours it: 96 × 64 decodes as 64 × 96.
  check(decoded.had && decoded.left === null && decoded.w === 64 && decoded.h === 96 && decoded.model === 'Pocket 3',
    `a real JPEG without its place still decodes (${JSON.stringify(decoded)})`);
  // Duplicate: a copy beside the original, numbered, never over a file that is there.
  const dup = await f.evaluate(async () => {
    await foafos.pod.put('notes/plan.txt', 'the plan', { contentType: 'text/plain' });
    await window.__files.go('notes/');
    const press = async () => {
      await window.__files.pick({ path: 'notes/plan.txt', container: false });
      for (let i = 0; i < 20 && ![...document.querySelectorAll('#detail button')].some((b) => b.textContent === 'Duplicate'); i++) await new Promise((r) => setTimeout(r, 50));
      [...document.querySelectorAll('#detail button')].find((b) => b.textContent === 'Duplicate').click();
      await new Promise((r) => setTimeout(r, 400));
    };
    await press(); await press();
    const a = await foafos.pod.get('notes/plan copy.txt'), b = await foafos.pod.get('notes/plan copy 2.txt');
    await Promise.all(['notes/plan.txt', 'notes/plan copy.txt', 'notes/plan copy 2.txt'].map((p) => foafos.pod.delete(p)));
    return { a: a.body, b: b.body };
  });
  check(dup.a === 'the plan' && dup.b === 'the plan', `Duplicate makes "plan copy.txt", then "plan copy 2.txt" (${JSON.stringify(dup)})`);
  // Moving: a file dragged onto a folder row moves there; onto a folder that has one by that name, nothing moves.
  const moved = await f.evaluate(async () => {
    await foafos.pod.put('notes/move-me.txt', 'moving', { contentType: 'text/plain' });
    await foafos.pod.put('notes/box/keep.txt', 'k', { contentType: 'text/plain' });
    await window.__files.go('notes/');
    const drag = (fromSel, toSel) => {
      const dt = new DataTransfer();
      document.querySelector(fromSel).dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
      const target = document.querySelector(toSel);
      target.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      const lit = target.classList.contains('drop-target');
      target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      return lit;
    };
    const lit = drag('#items tbody tr[data-path="notes/move-me.txt"]', '#items tbody tr[data-path="notes/box/"]');
    await new Promise((r) => setTimeout(r, 700));
    const there = (await foafos.pod.get('notes/box/move-me.txt')).body, gone = !(await foafos.pod.get('notes/move-me.txt')).ok;
    // A second file by the same name: refused, both stay.
    await foafos.pod.put('notes/keep.txt', 'other', { contentType: 'text/plain' });
    await window.__files.go('notes/');
    drag('#items tbody tr[data-path="notes/keep.txt"]', '#items tbody tr[data-path="notes/box/"]');
    await new Promise((r) => setTimeout(r, 700));
    const both = (await foafos.pod.get('notes/keep.txt')).body === 'other' && (await foafos.pod.get('notes/box/keep.txt')).body === 'k';
    const said = document.getElementById('status').textContent;
    await Promise.all(['notes/box/move-me.txt', 'notes/box/keep.txt', 'notes/keep.txt'].map((p) => foafos.pod.delete(p)));
    await window.__files.go('');
    return { lit, there, gone, both, said };
  });
  check(moved.lit && moved.there === 'moving' && moved.gone && moved.both && /there already/.test(moved.said),
    `dragging a file onto a folder moves it; a name already there is not replaced (${JSON.stringify(moved)})`);
  // Thumbnails: the photo shows a small picture of itself in the list and in the icon view.
  const thumb = await f.evaluate(async () => {
    await window.__files.go('notes/');
    const wait = () => new Promise((r) => setTimeout(r, 700));
    await wait();
    const inList = document.querySelector('#items tbody tr[data-path="notes/photo.png"] .ico img');
    document.getElementById('view').click();
    await wait();
    const inGrid = document.querySelector('#items .grid [data-path="notes/photo.png"] .ico img');
    document.getElementById('view').click();
    return { list: !!inList && inList.naturalWidth > 0, grid: !!inGrid && inGrid.naturalWidth > 0, small: !!inGrid && inGrid.naturalWidth <= 160 };
  });
  const tmPic = await f.evaluate(async () => {
    document.getElementById('space').click();
    for (let i = 0; i < 30 && !document.querySelector('.tm-pic img'); i++) await new Promise((r) => setTimeout(r, 100));
    const ok = !!document.querySelector('.tm-pic img')?.naturalWidth;
    document.getElementById('space').click();
    return ok;
  });
  check(tmPic, `an image's box in the Space view shows the picture (${tmPic})`);
  check(thumb.list && thumb.grid && thumb.small, `an image shows a thumbnail in the list and the icon view (${JSON.stringify(thumb)})`);
  check(dropped.shown && dropped.deleteOffered && dropped.noNull, `a photo shows in the side panel and can be deleted (${dropped.shown}, ${dropped.deleteOffered}, no stray null: ${dropped.noNull})`);
  await f.evaluate(() => Promise.all(['notes/dropped.txt', 'notes/photo.png'].map((p) => foafos.pod.delete(p))));
  // Icon view: Down goes to the item below, Up comes back.
  await f.evaluate(async () => { for (let i = 0; i < 9; i++) await foafos.pod.put(`notes/z${i}.txt`, 'x', { contentType: 'text/plain' }); await window.__files.go('notes/'); });
  await f.click('#view'); await page.waitForTimeout(300);
  const grid = await f.evaluate(() => {
    const items = [...document.querySelectorAll('#items .grid [role=option]')];
    items[0].focus();
    const top0 = items[0].getBoundingClientRect().top;
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const down = document.activeElement, below = down.getBoundingClientRect().top > top0 + 2;
    const sameCol = Math.abs(down.getBoundingClientRect().left - items[0].getBoundingClientRect().left) < 4;
    down.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    return { below, sameCol, back: document.activeElement === items[0], n: items.length };
  });
  check(grid.below && grid.sameCol && grid.back, `icon view: Down goes to the item below, Up comes back (${JSON.stringify(grid)})`);
  await f.click('#view');
  await f.evaluate(async () => { for (let i = 0; i < 9; i++) await foafos.pod.delete(`notes/z${i}.txt`); await window.__files.go('notes/'); });
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
  // Copy, cut and paste a file between folders: a copy lands beside nothing it replaces, a cut
  // moves once, and the system clipboard gets only the file's name
  const cc = await f.evaluate(async () => {
    await foafos.pod.put('notes/cc.txt', 'copy me', { contentType: 'text/plain' });
    await foafos.pod.put('notes/mv.txt', 'move me', { contentType: 'text/plain' });
    const settle = () => new Promise((r) => setTimeout(r, 500));
    const filter = document.getElementById('filter'); filter.value = ''; filter.dispatchEvent(new Event('input'));   // an earlier test left a filter
    const fire = (type, dt, target = document.activeElement || document.body) => target.dispatchEvent(new ClipboardEvent(type, { clipboardData: dt, bubbles: true, cancelable: true }));
    const focusRow = (p) => document.querySelector(`#items tbody tr[data-path="${p}"]`)?.focus();
    await window.__files.go('notes/'); await settle();
    const dt = new DataTransfer();
    focusRow('notes/cc.txt'); fire('copy', dt);
    const onClipboard = dt.getData('text/plain');
    await window.__files.go(''); await settle();
    fire('paste', dt, document.body); await settle();
    fire('paste', dt, document.body); await settle();            // a second copy, beside the first
    const copy1 = await foafos.pod.get('cc.txt'), copy2 = await foafos.pod.get('cc 2.txt'), orig = await foafos.pod.get('notes/cc.txt');
    await window.__files.go('notes/'); await settle();
    const dt2 = new DataTransfer();
    focusRow('notes/mv.txt'); fire('cut', dt2);
    await window.__files.go(''); await settle();
    fire('paste', dt2, document.body); await settle();
    fire('paste', dt2, document.body); await settle();            // already moved: nothing more
    const moved = await foafos.pod.get('mv.txt'), left = await foafos.pod.get('notes/mv.txt');
    const stray = (await foafos.pod.list('')).items.some((i) => /Pasted text/.test(i.path));
    const said = document.getElementById('status').textContent;
    for (const p of ['cc.txt', 'cc 2.txt', 'mv.txt', 'notes/cc.txt']) await foafos.pod.delete(p);
    return { onClipboard, copy1: copy1.body, copy2: copy2.body, orig: orig.body, moved: moved.body, left: left.ok, stray, said };
  });
  check(cc.onClipboard === 'cc.txt' && cc.copy1 === 'copy me' && cc.copy2 === 'copy me' && cc.orig === 'copy me' && cc.moved === 'move me' && !cc.left && !cc.stray && /moved already/.test(cc.said),
    `copy, cut and paste a file between folders (${JSON.stringify(cc)})`);
  // Choosing several: Shift + click takes a run, Ctrl + click takes one out, Delete asks once and
  // deletes the chosen files; Ctrl + A takes all shown, and Escape clears
  await f.evaluate(async () => {
    for (const n of ['m1', 'm2', 'm3']) await foafos.pod.put(`notes/${n}.txt`, n, { contentType: 'text/plain' });
    const filter = document.getElementById('filter'); filter.value = ''; filter.dispatchEvent(new Event('input'));
    await window.__files.go('notes/');
  });
  await page.waitForTimeout(500);
  const msRow = (n) => `#items tbody tr[data-path="notes/${n}.txt"]`;
  await f.click(msRow('m1'));
  await f.click(msRow('m3'), { modifiers: ['Shift'] });
  const msRun = await f.$$eval('#items tbody tr.chosen', (rs) => rs.map((r) => r.dataset.path));
  await f.click(msRow('m2'), { modifiers: ['ControlOrMeta'] });
  const msTwo = await f.$$eval('#items tbody tr.chosen', (rs) => rs.map((r) => r.dataset.path));
  await f.focus(msRow('m1'));
  await f.press(msRow('m1'), 'Delete');
  await page.waitForTimeout(300);
  const msAsked = await f.evaluate(() => document.querySelector('.ask')?.textContent || '');
  await f.click('.ask button.danger');
  await page.waitForTimeout(700);
  const msAfter = await f.evaluate(async () => ({ m1: (await foafos.pod.get('notes/m1.txt')).ok, m2: (await foafos.pod.get('notes/m2.txt')).ok, m3: (await foafos.pod.get('notes/m3.txt')).ok, said: document.getElementById('status').textContent }));
  await f.focus('#items tbody tr');
  await f.press('#items tbody tr', 'ControlOrMeta+a');
  const msAll = await f.evaluate(() => ({ chosen: document.querySelectorAll('#items tbody tr.chosen').length, rows: document.querySelectorAll('#items tbody tr').length }));
  await f.press('#items tbody tr', 'Escape');
  const msCleared = await f.evaluate(() => document.querySelectorAll('#items tbody tr.chosen').length);
  await f.evaluate(() => foafos.pod.delete('notes/m2.txt'));
  check(String(msRun) === 'notes/m1.txt,notes/m2.txt,notes/m3.txt' && String(msTwo) === 'notes/m1.txt,notes/m3.txt' && /Delete 2 files\?/.test(msAsked)
    && !msAfter.m1 && msAfter.m2 && !msAfter.m3 && /Deleted 2 files/.test(msAfter.said) && msAll.chosen === msAll.rows && msAll.rows > 0 && msCleared === 0,
    `choosing several files: Shift and Ctrl clicks, one question for Delete, Ctrl+A and Escape (${JSON.stringify({ msRun, msTwo, msAsked, msAfter, msAll, msCleared })})`);
  // Copy and cut act on all the chosen files: two copied go to the top together, two cut move together
  await f.evaluate(async () => {
    for (const n of ['k1', 'k2', 'c1', 'c2']) await foafos.pod.put(`notes/${n}.txt`, n, { contentType: 'text/plain' });
    await window.__files.go('notes/');
  });
  await page.waitForTimeout(500);
  const kRow = (n) => `#items tbody tr[data-path="notes/${n}.txt"]`;
  const clip = async (type) => f.evaluate((t) => { const dt = new DataTransfer(); (document.activeElement || document.body).dispatchEvent(new ClipboardEvent(t, { clipboardData: dt, bubbles: true, cancelable: true })); window.__dt = dt; return dt.getData('text/plain'); }, type);
  const pasteTop = async () => f.evaluate(async () => { await window.__files.go(''); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: window.__dt, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 700)); return document.getElementById('status').textContent; });
  await f.click(kRow('k1')); await f.click(kRow('k2'), { modifiers: ['ControlOrMeta'] });
  const kClip = await clip('copy');
  const kSaid = await pasteTop();
  await f.evaluate(() => window.__files.go('notes/')); await page.waitForTimeout(500);
  await f.click(kRow('c1')); await f.click(kRow('c2'), { modifiers: ['ControlOrMeta'] });
  await clip('cut');
  const cSaid = await pasteTop();
  const kc = await f.evaluate(async () => {
    const ok = async (p) => (await foafos.pod.get(p)).ok;
    const r = { k1: await ok('k1.txt'), k2: await ok('k2.txt'), k1kept: await ok('notes/k1.txt'), c1: await ok('c1.txt'), c2: await ok('c2.txt'), c1left: await ok('notes/c1.txt') };
    for (const p of ['k1.txt', 'k2.txt', 'c1.txt', 'c2.txt', 'notes/k1.txt', 'notes/k2.txt']) await foafos.pod.delete(p);
    return r;
  });
  check(kClip === 'k1.txt\nk2.txt' && /Pasted 2 files/.test(kSaid) && kc.k1 && kc.k2 && kc.k1kept && /Moved 2 files here/.test(cSaid) && kc.c1 && kc.c2 && !kc.c1left,
    `copy and cut act on all the chosen files (${JSON.stringify({ kClip, kSaid, cSaid, kc })})`);
  // In a short window the side panel scrolls rather than squeezing: the preview keeps its room,
  // and nothing in the panel lies over anything else
  await page.setViewportSize({ width: 1000, height: 560 });
  const tight = await f.evaluate(async () => {
    await foafos.pod.put('notes/tight.txt', 'words '.repeat(300), { contentType: 'text/plain' });
    await window.__files.go('notes/');
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector('#items tbody tr[data-path="notes/tight.txt"]').click();
    await new Promise((r) => setTimeout(r, 500));
    const kids = [...document.getElementById('detail').children].map((k) => k.getBoundingClientRect());
    const body = document.querySelector('#detail .detail-body')?.getBoundingClientRect();
    const out = { body: Math.round(body?.height || 0), overlap: kids.some((k, i) => i && k.top < kids[i - 1].bottom - 1) };
    await foafos.pod.delete('notes/tight.txt');
    return out;
  });
  await page.setViewportSize({ width: 1100, height: 760 });
  check(tight.body >= 100 && !tight.overlap, `in a short window the side panel keeps the preview's room (${JSON.stringify(tight)})`);
  // Files opens at the folder it was in, after a reload; a kept folder that has gone opens the top
  await f.evaluate(() => window.__files.go('notes/'));
  await page.waitForTimeout(300);
  await page.reload();
  f = await filesFrame(page);
  await f.waitForFunction(() => window.__files.state().items.length > 0, null, { timeout: 5000 }).catch(() => {});
  const reopenedIn = await f.evaluate(() => ({ folder: window.__files.state().folder, crumbs: document.getElementById('crumbs').textContent }));
  await f.evaluate(() => { const k = JSON.parse(localStorage.getItem('files.folder') || '{}'); const cur = window.__files.state().current; localStorage.setItem('files.folder', JSON.stringify({ ...k, [cur]: 'no-such-folder/' })); });
  await page.reload();
  f = await filesFrame(page);
  await page.waitForTimeout(600);
  const fellBack = await f.evaluate(() => ({ folder: window.__files.state().folder, said: document.getElementById('status').textContent }));
  check(reopenedIn.folder === 'notes/' && /notes/.test(reopenedIn.crumbs) && fellBack.folder === '' && !/No |not found|cannot/i.test(fellBack.said),
    `Files opens at the folder it was in after a reload, and at the top if that folder has gone (${JSON.stringify(reopenedIn)}, ${JSON.stringify(fellBack)})`);
  await filt('');
  await f.evaluate(() => Promise.all(['apple.txt', 'avocado.txt'].map((n) => foafos.pod.delete?.(`notes/${n}`))));
  await f.evaluate(() => window.__files.go(''));

  await page.screenshot({ path: process.env.SHOT || '/dev/null' }).catch(() => {});
  await f.click('#change-location');
  await page.waitForTimeout(300);
  await f.click('#add-folder');
  await page.waitForTimeout(800);
  s = await state(f);
  check(s.current?.startsWith('folder-'), `a chosen folder becomes a location (${s.current}, ${s.status || 'no error'})`);
  check(/You can open it in Finder/.test(s.where), 'the folder says Finder can show it');
  const folderWrite = await f.evaluate(() => foafos.pod.put('in-folder.txt', 'hi', { contentType: 'text/plain' }));
  const inFolder = await page.evaluate(async () => (await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('picked-folder')).getFileHandle('in-folder.txt')).getFile()).text());
  check(folderWrite.ok && inFolder === 'hi', 'a file lands in the chosen folder');
  await page.reload();
  f = await filesFrame(page);
  await f.waitForFunction(() => window.__files.state().items.length > 0, null, { timeout: 10000 }).catch(() => {});
  s = await state(f);
  check(s.current?.startsWith('folder-') && s.items.includes('in-folder.txt'), `the folder comes back after a reload (${s.items.join(', ')})`);

  // Open with: Notes gets this one file, in this one window, and nothing else.
  await f.evaluate(() => foafos.pod.put('other.txt', 'not shared', { contentType: 'text/plain' }));
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
    const saved = await f.evaluate(() => foafos.pod.get('in-folder.txt'));
    check(saved.body === 'edited in Notes', `saving in Notes writes the file in the folder (${saved.body})`);
    const reach = await editor.evaluate(async (share) => ({
      via: (await foafos.pod.get('other.txt', { share })).body,
      own: (await foafos.pod.get('../../other.txt')).ok,
      del: (await foafos.pod.delete('', { share })).reason,
    }), token);
    check(reach.via === 'edited in Notes' && reach.own === false && reach.del === 'denied', `the share reaches only that file (${JSON.stringify(reach)})`);
    const failedLoad = await editor.evaluate(async () => {
      const get = foafos.pod.get;
      foafos.pod.get = async () => ({ ok: false, reason: 'offline' });
      document.getElementById('reload').click();
      await new Promise((r) => setTimeout(r, 200));
      foafos.pod.get = get;
      const out = { save: document.getElementById('save').disabled, text: document.getElementById('text').readOnly };
      document.getElementById('reload').click();
      await new Promise((r) => setTimeout(r, 300));
      return { ...out, back: !document.getElementById('save').disabled };
    });
    check(failedLoad.save && failedLoad.text && failedLoad.back, `a shared file that fails to load cannot be saved over (${JSON.stringify(failedLoad)})`);
    const md = await f.evaluate(async () => { await foafos.pod.put('kept.md', '# hi', { contentType: 'text/markdown' }); return (await foafos.pod.get('kept.md')).contentType; });
    const switched = await editor.evaluate(async () => {
      await window.__podnotes.save();
      await foafos.pod.put('notes/mine.txt', 'my own note', { contentType: 'text/plain' });
      await window.__podnotes.open('mine');
      await window.__podnotes.save();
      return { shared: window.__podnotes.state().shared, locked: document.getElementById('name').readOnly };
    });
    const still = await f.evaluate(() => foafos.pod.get('in-folder.txt'));
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
    const kept = await f.evaluate(() => foafos.pod.get('kept.md'));
    check(kept.body === '# edited' && /markdown/.test(kept.contentType), `saving in Notes keeps the file's type (${kept.contentType})`);
    await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].filter((w) => w.querySelector('iframe')?.src.includes('podnotes')).at(-1).querySelector('[aria-label^="Close"]').click());
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => FoafOS.pods.shares.size);
    await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].filter((w) => w.querySelector('iframe')?.src.includes('podnotes')).at(-1).querySelector('[aria-label^="Close"]').click());
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => FoafOS.pods.shares.size);
    check(before === 1 && after === 0, `closing the window ends the share (${before} then ${after})`);
  }
  const notText = await f.evaluate(() => foafos.pod.openWith('podnotes', 'photo.png', 'image/png'));
  check(notText.reason === 'denied', `an app is not opened on a file it does not handle (${notText.reason})`);

  const denied = await page.evaluate(async () => {
    await FoafOS.launchApp('podnotes');
    return true;
  });
  await page.waitForTimeout(1500);
  const notes = page.frames().find((x) => /podnotes/.test(x.url()));
  const other = notes ? await notes.evaluate(() => Promise.all([foafos.pod.locations(), foafos.pod.use('device'), foafos.pod.addFolder()])) : null;
  check(denied && other?.every((r) => r.ok === false && r.reason === 'denied'), `an ordinary app cannot list or switch locations (${other?.map((r) => r.reason)})`);
  check(!errors.length, `no page errors (${errors.slice(0, 2).join(' | ').slice(0, 160)})`);
} catch (e) { check(false, `exception: ${e.message.slice(0, 300)}`); }
await cleanup();
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
