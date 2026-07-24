#!/usr/bin/env node
// The two-spreadsheets test with the REAL spreadsheet: edot's Data app
// (SQLite-WASM) running twice as sandboxed foafos guests.
//
//   node packages/foafos/test/e2e-guest-data.mjs   (from repo root)
//
// Asserts: both instances boot their own SQLite; a table created in A
// does not exist in B (disjoint databases); A sharing a table crosses
// the scoped bus as a granted topic; nothing leaks outside grants.

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const PORT = 8148;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// CORS server: sandboxed iframes have opaque origins — the app's ES
// modules and the sql.js WASM fetch need it locally (GitHub Pages
// provides it in production).
const CORS_SERVER = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', ${PORT}),
    functools.partial(H, directory='${repoRoot}')).serve_forever()
`;
const server = spawn('python3', ['-c', CORS_SERVER], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

const fail = (m) => { console.error('✖', m); process.exitCode = 1; };
const pass = (m) => console.log('✔', m);

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));

  await page.goto(`http://127.0.0.1:${PORT}/magpie/edot/data/guest-demo.html`);
  await page.waitForFunction(() =>
    window.__events?.filter(e => e.topic === 'sys.guest.ready').length === 2, null, { timeout: 30000 });
  pass('two edot Data guests announced ready');

  const frames = () => page.frames().filter(f => f.url().includes('data/guest.html'));
  const [fa, fb] = frames();
  for (const [f, label] of [[fa, 'A'], [fb, 'B']]) {
    await f.waitForFunction(() => document.querySelector('edot-data')?.engine?.db, null, { timeout: 30000 });
    pass(`${label}: SQLite-WASM engine booted in its own sandbox`);
  }

  // disjoint databases: create a table in A only
  await fa.evaluate(() => document.querySelector('edot-data').addTable('Birds',
    ['name', 'count'], [['robin', 1], ['wren', 2]]));
  await page.waitForTimeout(400);
  const inA = await fa.evaluate(() =>
    document.querySelector('edot-data').engine.query("SELECT name FROM sqlite_master WHERE name='Birds'").rows.length);
  const inB = await fb.evaluate(() =>
    document.querySelector('edot-data').engine.query("SELECT name FROM sqlite_master WHERE name='Birds'").rows.length);
  inA === 1 && inB === 0
    ? pass('disjoint databases: Birds exists in A, absent in B')
    : fail(`db state leaked: A=${inA} B=${inB}`);

  // sharing crosses the scoped bus as a granted topic
  await fa.evaluate(() => window.__edotKernel.bus.publish('data:share',
    { title: 'Birds', columns: ['name', 'count'], rows: [['robin', 1], ['wren', 2]] }));
  await page.waitForTimeout(400);
  const share = await page.evaluate(() =>
    window.__events.find(e => e.topic === 'widget.data.a.share')?.data ?? null);
  share?.title === 'Birds' && share.rows.length === 2
    ? pass('A shared a table — arrived on the host bus under its granted topic')
    : fail(`share missing: ${JSON.stringify(share)}`);

  // and it carries the guest source stamp
  const stamped = await page.evaluate(() =>
    window.__events.find(e => e.topic === 'widget.data.a.share')?.source);
  stamped === 'guest:a' ? pass('share is source-stamped guest:a') : fail(`bad stamp: ${stamped}`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nDATA GUEST E2E: FAIL' : '\nDATA GUEST E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nDATA GUEST E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
