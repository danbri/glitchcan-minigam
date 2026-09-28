#!/usr/bin/env node
// The Task Manager (the switcher): what is running, what opened it, what it
// may do — in the table format people already know.
//
//   node inklet/finkapp/test/e2e-taskmanager.mjs
//
// Locks what the owner asked for (September 2026: "sortable columns,
// open/close widget affordances, filter/highlight, anticipating common user
// and developer tasks") and what an earlier phone screenshot got wrong:
// action buttons pushed off the right edge, a details row that squeezed the
// name column.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8172;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}/${repoName}`;

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
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function frameMatching(page, re, tries = 80) {
  for (let i = 0; i < tries; i++) {
    const f = page.frames().find((fr) => re.test(fr.url()));
    if (f) return f;
    await wait(250);
  }
  return null;
}

// A boxed story that opened the cellar (three levels deep), plus Data, a
// second top-level app that holds storage.
async function scene(context, viewport) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/inklet/finkapp/?story=/${repoName}/drift-city/novel/cellar-entry.fink.js`);
  await page.waitForFunction(() => window.FoafOS?.apps, null, { timeout: 20000 });
  const runner = await frameMatching(page, /apps\/storyrunner/);
  if (!runner) throw new Error('no story runner frame');
  await runner.waitForFunction(() => window.__storyrunner?.ready?.()
    && window.__storyrunner.state.choices.length > 0, null, { timeout: 25000 });
  await runner.evaluate(() => window.__storyrunner.choose(0));
  const cellar = await frameMatching(page, /drift-city\/novel\/cellar\.html/);
  if (!cellar) throw new Error('the cellar never opened');
  await page.evaluate(() => FoafOS.launchApp('sheets'));
  await page.waitForFunction(() => [...FoafOS.apps.nodes.values()].some((n) => n.appId === 'sheets'));
  await wait(600);
  return { page, errs };
}

// Rows as "depth:label", with "(ctx)" for context rows.
const rows = (page) => page.evaluate(() => [...document.querySelectorAll('#foafos-switcher tr.foafos-switch-row')]
  .map((r) => `${r.style.getPropertyValue('--depth')}:${r.querySelector('.ttl')?.textContent}`
    + (r.classList.contains('context') ? '(ctx)' : '')));
const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const rowOf = (label) => `[...document.querySelectorAll('#foafos-switcher tr.foafos-switch-row')]`
  + `.find((r) => r.querySelector('.ttl')?.textContent === ${JSON.stringify(label)})`;

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${PORT}` });
  const { page, errs } = await scene(context, { width: 1280, height: 800 });

  // 1. a named modal dialog that opens on the first app to switch to
  const opened = await page.evaluate(() => {
    const sw = FoafOS.openSwitcher();
    const title = document.getElementById(sw.getAttribute('aria-labelledby'))?.textContent || '';
    return { role: sw.getAttribute('role'), modal: sw.getAttribute('aria-modal'), title,
             focus: document.activeElement?.getAttribute('aria-label') || '' };
  });
  opened.role === 'dialog' && opened.modal === 'true' && /^Task Manager/.test(opened.title)
    && /^Switch to /.test(opened.focus)
    ? pass(`a modal dialog named "Task Manager", focus on "${opened.focus}"`)
    : fail(`dialog: ${JSON.stringify(opened)}`);
  const all = await rows(page);
  all.includes('3:The Lantern Cellar') && all.includes('1:Data') && all[0].startsWith('0:')
    ? pass(`one row per running node, as the tree: ${all.join(' | ')}`)
    : fail(`rows: ${all.join(' | ')}`);

  // 1b. the brick row between two families of apps, and the note that says
  // what it does not stop (owner, September 2026: "be clear on limits")
  const wall = await page.evaluate(() => {
    const sw = document.getElementById('foafos-switcher');
    const walls = [...sw.querySelectorAll('tr.foafos-tm-wall')];
    const next = walls[0]?.nextElementSibling?.querySelector('.ttl')?.textContent;
    const note = sw.querySelector('details.foafos-tm-limits');
    return { n: walls.length, next, said: walls[0]?.querySelector('.sr-only')?.textContent,
             bricks: walls[0]?.querySelector('.bricks')?.getAttribute('aria-hidden'),
             summary: note?.querySelector('summary')?.textContent.trim(),
             body: note?.querySelector('.foafos-tm-limits-body')?.textContent.replace(/\s+/g, ' ') };
  });
  wall.n === 1 && wall.next === 'Data' && wall.said === 'Sandbox partition' && wall.bricks === 'true'
    && /The sandbox and its limits/.test(wall.summary)
    && /any server/.test(wall.body) && /CPU/.test(wall.body) && /side channels/.test(wall.body)
    ? pass('a brick row ("Sandbox partition") divides the two families, and a note says what it does not stop')
    : fail(`wall: ${JSON.stringify(wall)}`);

  // 2. sortable columns: siblings reorder, children stay under their parent
  const sortBy = (key) => click(page, `#foafos-switcher [data-focus="sort:${key}"]`);
  const ariaSort = (key) => page.evaluate((k) => document.querySelector(`#foafos-switcher th.c-${k}`)
    ?.getAttribute('aria-sort'), key);
  const top = async () => (await rows(page)).filter((r) => r.startsWith('1:')).map((r) => r.slice(2));
  await sortBy('name');
  const az = { order: await top(), aria: await ariaSort('name') };
  await sortBy('name');
  const za = { order: await top(), aria: await ariaSort('name') };
  await sortBy('name');
  const none = await ariaSort('name');
  az.aria === 'ascending' && za.aria === 'descending' && none === 'none'
    && az.order.join() === [...az.order].sort((a, b) => a.localeCompare(b)).join()
    && za.order.join() === [...az.order].reverse().join()
    ? pass(`Name sorts A to Z, then Z to A, then back to tree order (${az.order.join(', ')})`)
    : fail(`name sort: ${JSON.stringify({ az, za, none })}`);
  await sortBy('powers');
  const most = await rows(page);
  const kids = most.indexOf('2:cellar entry') === most.indexOf('1:Finkosphere') + 1
    && most.indexOf('3:The Lantern Cellar') === most.indexOf('2:cellar entry') + 1;
  (await ariaSort('powers')) === 'descending' && most.indexOf('1:Finkosphere') < most.indexOf('1:Data') && kids
    ? pass('Powers sorts most first, and every child stays under the app that opened it')
    : fail(`powers sort: ${most.join(' | ')}`);
  await sortBy('powers'); await sortBy('powers');

  // 3. filter: matches marked, ancestors kept as dimmed context
  const filterTo = (q) => page.evaluate((v) => {
    const f = document.querySelector('.foafos-tm-filter');
    f.value = v; f.dispatchEvent(new Event('input', { bubbles: true }));
  }, q);
  await filterTo('lantern');
  const lantern = { rows: await rows(page),
    marks: await page.evaluate(() => [...document.querySelectorAll('#foafos-switcher mark')].map((m) => m.textContent)),
    status: await page.evaluate(() => document.querySelector('.foafos-tm-status').textContent),
    // the dimming is for the eye; the card's description says it for everyone
    said: await page.evaluate(() => [...document.querySelectorAll('#foafos-switcher tr.foafos-switch-row.context .sub')]
      .every((s) => s.textContent.startsWith('Shown for context'))) };
  lantern.rows.join() === '0:Finkiverse(ctx),1:Finkosphere(ctx),2:cellar entry(ctx),3:The Lantern Cellar'
    && lantern.marks.includes('Lantern') && lantern.said
    && /^1 of \d+ match; 3 more shown for context/.test(lantern.status)
    ? pass(`filtering marks the match and keeps the apps above it as context ("${lantern.status}")`)
    : fail(`filter "lantern": ${JSON.stringify(lantern)}`);
  await filterTo('storage');
  const stor = await rows(page);
  stor.includes('1:Data') && !stor.some((r) => r.startsWith('1:Finkosphere'))
    ? pass(`a power's name filters too: "storage" finds ${stor.filter((r) => !r.endsWith('(ctx)')).join(', ')}`)
    : fail(`filter "storage": ${stor.join(' | ')}`);
  await filterTo('zzzz');
  const empty = await page.evaluate(() => document.querySelector('.foafos-tm-empty')?.textContent || '');
  await click(page, '#foafos-switcher [data-focus="tools:clear"]');
  const cleared = (await rows(page)).length;
  /Nothing running matches/.test(empty) && cleared === all.length
    ? pass('no match says so, and "Clear the filter" brings every row back')
    : fail(`empty state: "${empty}", rows after clearing ${cleared}`);

  // 4. quick filters
  await click(page, '#foafos-switcher [data-focus="only:storage"]');
  const only = { rows: await rows(page),
    pressed: await page.evaluate(() => document.querySelector('[data-focus="only:storage"]').getAttribute('aria-pressed')) };
  await click(page, '#foafos-switcher [data-focus="only:storage"]');
  only.pressed === 'true' && only.rows.includes('1:Data') && !only.rows.some((r) => r.startsWith('3:'))
    ? pass('"Storage" shows only what may keep data (a pressed toggle)')
    : fail(`quick filter: ${JSON.stringify(only)}`);

  // 5. fold and unfold, one row and all
  await page.evaluate(`${rowOf('Finkosphere')}.querySelector('.foafos-tm-twisty').click()`);
  const folded = { rows: await rows(page), expanded: await page.evaluate(`${rowOf('Finkosphere')}.querySelector('.foafos-tm-twisty').getAttribute('aria-expanded')`) };
  await page.evaluate(`${rowOf('Finkosphere')}.querySelector('.foafos-tm-twisty').click()`);
  const unfolded = await rows(page);
  !folded.rows.some((r) => r.startsWith('2:')) && folded.expanded === 'false' && unfolded.includes('3:The Lantern Cellar')
    ? pass('a row folds and unfolds its subtree, and says which with aria-expanded')
    : fail(`fold: ${JSON.stringify({ folded, unfolded })}`);
  await click(page, '#foafos-switcher [data-focus="tools:fold"]');
  const allFolded = await rows(page);
  await click(page, '#foafos-switcher [data-focus="tools:fold"]');
  allFolded.every((r) => /^[01]:/.test(r)) && (await rows(page)).length === all.length
    ? pass('"Collapse all" leaves the top-level apps; "Expand all" brings the rest back')
    : fail(`fold all: ${allFolded.join(' | ')}`);

  // 6. keyboard, as in a tree view: Up/Down move between rows; Right on an
  // open row goes to its first child; Left on a leaf goes to the parent;
  // Left on an open row folds it and Right unfolds it, focus staying put
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  await page.evaluate(`${rowOf('Finkosphere')}.querySelector('.foafos-switch-card').focus()`);
  await page.keyboard.press('ArrowDown');
  const down = await focused();
  await page.keyboard.press('ArrowRight');                     // open: to its first child
  const right = await focused();
  await page.keyboard.press('ArrowLeft');                      // a leaf: to its parent
  const left = await focused();
  await page.keyboard.press('ArrowLeft');                      // open: folds it
  const foldedByKey = !(await rows(page)).some((r) => r.startsWith('3:')) && (await focused()) === left;
  await page.keyboard.press('ArrowRight');                     // folded: unfolds it
  const unfoldedByKey = (await rows(page)).includes('3:The Lantern Cellar') && (await focused()) === left;
  down === 'Switch to cellar entry' && right === 'Switch to The Lantern Cellar' && left === 'Switch to cellar entry'
    && foldedByKey && unfoldedByKey
    ? pass('arrows work as in a tree view: Down, Right to a child, Left to the parent, Left folds, Right unfolds')
    : fail(`keys: ${JSON.stringify({ down, right, left, foldedByKey, unfoldedByKey })}`);
  await page.keyboard.type('dat');
  const typed = await page.evaluate(() => ({ focus: document.activeElement?.className,
    value: document.querySelector('.foafos-tm-filter').value }));
  await page.keyboard.press('Escape');
  const afterFirst = await page.evaluate(() => ({ open: !!document.getElementById('foafos-switcher'),
    value: document.querySelector('.foafos-tm-filter')?.value }));
  await page.keyboard.press('Escape');
  const afterSecond = await page.evaluate(() => !!document.getElementById('foafos-switcher'));
  typed.value === 'dat' && /foafos-tm-filter/.test(typed.focus) && afterFirst.open && afterFirst.value === '' && !afterSecond
    ? pass('typing in the list goes to the filter; Escape empties it, then closes')
    : fail(`typing/escape: ${JSON.stringify({ typed, afterFirst, afterSecond })}`);

  // 7. chrome is hidden until asked for, and the choice is remembered
  await page.evaluate(() => FoafOS.openSwitcher());
  const hidden = (await rows(page)).some((r) => /Breadcrumb|WMBling/.test(r));
  await click(page, '#foafos-switcher [data-focus="tools:chrome"]');
  const shown = (await rows(page)).filter((r) => /Breadcrumb|WMBling|Status line/.test(r)).length;
  const saved = await page.evaluate(() => localStorage.getItem('foafos.tm.chrome'));
  await page.evaluate(() => { FoafOS.openSwitcher(); FoafOS.openSwitcher(); });   // close, reopen
  const kept = (await rows(page)).some((r) => /Breadcrumb/.test(r));
  await click(page, '#foafos-switcher [data-focus="tools:chrome"]');
  !hidden && shown >= 3 && saved === '1' && kept
    ? pass(`chrome is hidden by default, one press shows it (${shown} rows), and the choice is kept`)
    : fail(`chrome toggle: ${JSON.stringify({ hidden, shown, saved, kept })}`);

  // 8. details: every power in force, and a developer's handles on it
  await page.evaluate(`${rowOf('Data')}.querySelector('.foafos-switch-info').click()`);
  const details = await page.evaluate(() => {
    const d = document.querySelector('.foafos-tm-details');
    const get = (k) => [...(d?.querySelectorAll('.fi-row') || [])].find((r) => r.querySelector('.fi-k')?.textContent === k)
      ?.querySelector('.fi-v')?.textContent || '';
    return { ids: get('ids'), sandbox: get('sandbox'), bus: get('bus'),
             expanded: document.querySelector('.foafos-tm-details')?.previousElementSibling
               ?.querySelector('.foafos-switch-info')?.getAttribute('aria-expanded') };
  });
  /app\d+ · sheets/.test(details.ids) && /allow-scripts/.test(details.sandbox) && /app\.sheets\.\*/.test(details.bus)
    && details.expanded === 'true'
    ? pass(`details show ids, sandbox and bus scope (${details.ids.split('Copy')[0].trim()})`)
    : fail(`details: ${JSON.stringify(details)}`);
  await click(page, '#foafos-switcher .foafos-tm-details [data-focus$=":copy"]');
  await wait(300);
  const copied = await page.evaluate(async () => {
    const pre = document.querySelector('.foafos-tm-json')?.textContent;
    try { return JSON.parse(pre || await navigator.clipboard.readText()); } catch (e) { return null; }
  });
  copied?.appId === 'sheets' && copied.capabilities?.includes('storage') && copied.scopes?.bus
    ? pass('"Copy as JSON" gives the node, its powers and its scopes')
    : fail(`copy: ${JSON.stringify(copied)}`);
  await click(page, '#foafos-switcher .foafos-tm-details [data-focus$=":log"]');
  await wait(300);
  const logger = await page.evaluate(() => ({ tm: !!document.getElementById('foafos-switcher'),
    filter: document.getElementById('foafos-log-filter')?.value }));
  !logger.tm && logger.filter === 'sheets'
    ? pass('"Show in Logger" opens the Logger filtered to that app')
    : fail(`logger: ${JSON.stringify(logger)}`);
  await page.evaluate(() => document.getElementById('foafos-logger')?.remove());

  // 9. live: a row goes when its app closes, with the dialog still open
  await page.evaluate(() => FoafOS.openSwitcher());
  await page.evaluate(() => { for (const n of [...FoafOS.apps.nodes.values()]) if (n.appId === 'sheets') FoafOS.apps.close(n.id); });
  await wait(250);
  const live = await rows(page);
  !live.includes('1:Data') && live.includes('3:The Lantern Cellar')
    ? pass('the list follows the tree while it is open: a closed app\'s row goes at once')
    : fail(`live update: ${live.join(' | ')}`);

  // 10. pause from the row, and the row says so
  await page.evaluate(`${rowOf('The Lantern Cellar')}.querySelector('[data-focus$=":pause"]').click()`);
  await wait(200);
  const paused = await page.evaluate(`({ state: ${rowOf('The Lantern Cellar')}.querySelector('.c-state').textContent,
    cls: ${rowOf('The Lantern Cellar')}.classList.contains('paused'),
    label: ${rowOf('The Lantern Cellar')}.querySelector('[data-focus$=":pause"]').getAttribute('aria-label') })`);
  await page.evaluate(`${rowOf('The Lantern Cellar')}.querySelector('[data-focus$=":pause"]').click()`);
  /^Paused/.test(paused.state) && paused.cls && /^Resume The Lantern Cellar/.test(paused.label)
    ? pass('pausing from the row shows "Paused", and the button offers "Resume"')
    : fail(`pause: ${JSON.stringify(paused)}`);
  await page.evaluate(() => document.getElementById('foafos-switcher')?.remove());

  // 11. phone width: two columns, nothing past the edge, details full width
  // (Data again, so a brick row is there to overflow if it can)
  await page.evaluate(() => FoafOS.launchApp('sheets'));
  await page.waitForFunction(() => [...FoafOS.apps.nodes.values()].some((n) => n.appId === 'sheets'));
  await page.evaluate(() => FoafOS.openSwitcher());
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(300);
  const narrow = await page.evaluate(async () => {
    const sw = document.getElementById('foafos-switcher');
    const scroll = sw.querySelector('.foafos-tm-scroll');
    const acts = [...sw.querySelectorAll('.foafos-switch-act')].filter((b) => b.getBoundingClientRect().width);
    const hiddenCols = ['c-kind', 'c-state', 'c-powers', 'c-place']
      .every((c) => getComputedStyle(sw.querySelector(`th.${c}`)).display === 'none');
    const nameW = sw.querySelector('th.c-name').getBoundingClientRect().width;
    // the action cells are their buttons' width, not a 0px column they overflow
    const actW = Math.min(...[...sw.querySelectorAll('tr.foafos-switch-row td.c-act')]
      .map((td) => td.getBoundingClientRect().width));
    sw.querySelector('tr.foafos-switch-row .foafos-switch-info').click();
    await new Promise((r) => setTimeout(r, 150));
    return { overflow: scroll.scrollWidth - scroll.clientWidth,
             actsInView: acts.every((b) => b.getBoundingClientRect().right <= innerWidth),
             hiddenCols, nameW, actW, walls: sw.querySelectorAll('tr.foafos-tm-wall').length,
             nameWWithDetails: sw.querySelector('th.c-name').getBoundingClientRect().width };
  });
  narrow.overflow === 0 && narrow.actsInView && narrow.hiddenCols && narrow.actW >= 120 && narrow.walls === 1
    && Math.abs(narrow.nameWWithDetails - narrow.nameW) < 2
    ? pass(`at 390px: two columns, no sideways scroll, every button on screen; a details row keeps the name column (${Math.round(narrow.nameW)}px)`)
    : fail(`phone layout: ${JSON.stringify(narrow)}`);

  errs.length === 0 ? pass('no page errors') : fail(`page errors: ${errs.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nTASK MANAGER E2E: FAIL' : '\nTASK MANAGER E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 400)}`);
  console.log('\nTASK MANAGER E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
