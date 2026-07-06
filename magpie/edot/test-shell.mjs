// test-shell.mjs — the unified menu-driven shell (index.html): a single entry
// point with a File/Edit/View menu bar that adapts per app, MS-Access-style data
// views, and working menu actions. Verifies the showcase end to end.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ndjson': 'application/x-ndjson', '.wasm': 'application/wasm' };
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
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/index.html`);
  await page.waitForFunction(() => document.querySelector('.menubar') && document.querySelectorAll('.rail button').length >= 7);

  // One entry point: persistent app rail + a menu bar.
  ok('single shell: app rail + menu bar present', await page.$('.rail button[data-nav="editor"]') && await page.$('.menubar'));

  // Menu bar adapts per app.
  await page.click('.rail button[data-nav="editor"]');
  await page.waitForSelector('.view[data-app="editor"] edot-editor .page');
  await page.waitForFunction(() => [...document.querySelectorAll('.menubar > button')].some((b) => b.textContent === 'Insert'));
  const editorTops = await page.$$eval('.menubar > button', (e) => e.map((b) => b.textContent));
  ok('Editor shows File / Edit / Insert / Format / View / Help', ['File', 'Edit', 'Insert', 'Format', 'View', 'Help'].every((t) => editorTops.includes(t)));

  // A menu action runs (Format → Heading 1 applies <h1> to the selection).
  await page.evaluate(() => {
    const ed = document.querySelector('.view[data-app="editor"] edot-editor');
    ed.setContent('<p>hello</p>');
    const el = ed.querySelector('.page'); const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); el.focus();
  });
  await page.click('.menubar > button[data-top="Format"]'); await page.waitForTimeout(120);
  await page.click('.menu .mi:has-text("Heading 1")'); await page.waitForTimeout(150);
  ok('Editor menu action works (Format → Heading 1)', /<h1/i.test(await page.evaluate(() => document.querySelector('.view[data-app="editor"] edot-editor').getContent())));

  // Ctrl+F opens the editor's Find & replace (not browser find), and the bar is
  // styled shell chrome (fixed-positioned), not an unstyled body dump.
  await page.keyboard.press('Control+f'); await page.waitForTimeout(150);
  const find = await page.evaluate(() => {
    const bar = document.querySelector('.find-bar'); if (!bar || bar.hidden) return null;
    const cs = getComputedStyle(bar);
    return { present: true, styled: cs.position === 'fixed', hasInput: !!bar.querySelector('.find-input') };
  });
  ok('Ctrl+F opens a styled Find & replace bar in the suite', !!find && find.present && find.styled && find.hasInput);
  await page.keyboard.press('Escape');
  // Format menu carries the full formatting surface (parity with the toolbar).
  await page.click('.menubar > button[data-top="Format"]'); await page.waitForTimeout(120);
  const fmtItems = await page.$$eval('.menu .mi .lbl', (e) => e.map((x) => x.textContent));
  ok('Format menu has strikethrough / justify / indent (toolbar parity)',
    ['Strikethrough', 'Justify', 'Increase indent', 'Decrease indent'].every((t) => fmtItems.includes(t)));
  await page.keyboard.press('Escape');

  // Data app: MS-Access-style data views in the View menu, and an action works.
  await page.click('.rail button[data-nav="data"]');
  await page.waitForSelector('.view[data-app="data"] edot-data .dw');
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('.menubar > button')]; return b.length && b.every((x) => x.textContent !== 'Insert'); });
  await page.click('.menubar > button[data-top="View"]'); await page.waitForTimeout(150);
  const dataViews = await page.$$eval('.menu .mi .lbl', (e) => e.map((x) => x.textContent));
  ok('Data View menu offers data views (query / spreadsheet / datasheet)',
    dataViews.some((l) => /query/i.test(l)) && dataViews.some((l) => /spreadsheet/i.test(l)) && dataViews.some((l) => /datasheet/i.test(l)));
  await page.click('.menu .mi:has-text("Chinook")'); await page.waitForTimeout(2500);
  ok('Data menu action works (load sample DB populates objects)',
    (await page.evaluate(() => document.querySelectorAll('.view[data-app="data"] .dw-side .dw-item').length)) > 5);

  // View → Open app submenu switches apps.
  await page.click('.menubar > button[data-top="View"]'); await page.waitForTimeout(120);
  await page.click('.menu .mi:has-text("Open app")'); await page.waitForTimeout(120);
  await page.click('.menu .mi:has-text("Calendar")'); await page.waitForTimeout(800);
  ok('View → Open app switches the active app', await page.evaluate(() => location.hash === '#calendar' && !document.querySelector('.view[data-app="calendar"]').hidden));

  // Mobile: Workspace is a core surface and must stay reachable on every device.
  // It appears in the rail and, when opened on a phone, shows one pane at a time
  // via its own sub-tabs (not the desktop side-by-side multi-pane).
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(`http://127.0.0.1:${port}/magpie/edot/index.html`);
  await mob.waitForSelector('.rail button[data-nav="editor"]');
  await mob.waitForTimeout(1000);
  const railVisible = await mob.$$eval('.rail button', (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.nav));
  ok('mobile: Workspace is reachable in the rail (core surface, not hidden)', railVisible.includes('workspace') && railVisible.includes('editor'));
  // Open Workspace on the phone and confirm it shows a single pane via sub-tabs.
  await mob.click('.rail button[data-nav="workspace"]'); await mob.waitForTimeout(800);
  const ws = await mob.evaluate(() => {
    const v = document.querySelector('.view[data-app="workspace"]');
    if (!v || v.hidden) return null;
    const subtabs = v.querySelector('.ws-subtabs');
    const panes = [...v.querySelectorAll('.ws-pane')];
    const visible = panes.filter((p) => p.offsetParent !== null);
    return { hasSubtabs: !!subtabs && subtabs.offsetParent !== null, panes: panes.length, visible: visible.length };
  });
  ok('mobile: Workspace opens with sub-tabs and shows one pane at a time', !!ws && ws.hasSubtabs && ws.panes === 3 && ws.visible === 1);

  // Mobile: a right-anchored dropdown must stay inside the viewport (clamped),
  // not spill off-screen — the Format menu opens near the right edge.
  await mob.click('.rail button[data-nav="editor"]'); await mob.waitForTimeout(300);
  await mob.click('.menubar > button[data-top="Format"]'); await mob.waitForTimeout(150);
  const clamp = await mob.evaluate(() => {
    const m = document.querySelector('.menu'); if (!m) return null;
    const r = m.getBoundingClientRect();
    return { left: r.left, right: r.right, bottom: r.bottom, w: window.innerWidth, h: window.innerHeight };
  });
  ok('mobile: an open menu is clamped within the viewport (no off-screen spill)',
    !!clamp && clamp.left >= -1 && clamp.right <= clamp.w + 1 && clamp.bottom <= clamp.h + 1);
  await mob.keyboard.press('Escape');

  // Mobile: the top bar keeps the login chip fully visible (menu bar scrolls
  // instead of pushing chrome off-screen) even at a very narrow width.
  await mob.setViewportSize({ width: 340, height: 720 }); await mob.waitForTimeout(200);
  const bar = await mob.evaluate(() => {
    const login = document.querySelector('.topbar .login').getBoundingClientRect();
    const mb = document.querySelector('.menubar');
    return { loginVisible: login.right <= window.innerWidth + 1 && login.left >= 0, btns: mb.querySelectorAll('button').length };
  });
  ok('mobile: login stays fully visible + all menus present (top bar not clipped)', bar.loginVisible && bar.btns === 6);

  // Mobile: the command palette has a visible touch entry point (no ⌘K on touch).
  await mob.click('#cmdk-btn'); await mob.waitForTimeout(150);
  ok('mobile: the 🔍 button opens the command palette (touch-reachable commands)',
    await mob.evaluate(() => { const c = document.querySelector('.cmdk'); return !!c && !c.hidden && !!document.querySelector('.cmdk-input'); }));
  await mob.keyboard.press('Escape');
  await mob.close();

  ok('no page errors', errs.length === 0);
} finally {
  await browser.close();
  server.close();
}

console.log(fail ? 'SHELL FAIL' : 'SHELL OK');
process.exit(fail ? 1 : 0);
