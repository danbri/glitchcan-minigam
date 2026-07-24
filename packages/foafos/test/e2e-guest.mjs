#!/usr/bin/env node
// The two-spreadsheets test: two sandboxed instances of ONE widget,
// disjoint state, granted comms only, forbidden publishes dropped.
//
//   node packages/foafos/test/e2e-guest.mjs

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const PORT = 8147;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', repoRoot], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

const fail = (m) => { console.error('✖', m); process.exitCode = 1; };
const pass = (m) => console.log('✔', m);

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));

  await page.goto(`http://127.0.0.1:${PORT}/packages/foafos/demo/guests.html`);
  await page.waitForFunction(() =>
    window.__events?.filter(e => e.topic === 'sys.guest.ready').length === 2, null, { timeout: 15000 });
  pass('two instances of the same widget booted as separate guests');

  const frames = () => page.frames().filter(f => f.url().includes('tally/index.html'));
  const frameA = frames()[0], frameB = frames()[1];

  // state isolation: bump A twice, B stays at 0
  await frameA.click('#bump');
  await frameA.click('#bump');
  await page.waitForTimeout(300);
  const counts = [
    await frameA.evaluate(() => document.getElementById('count').textContent),
    await frameB.evaluate(() => document.getElementById('count').textContent),
  ];
  counts[0] === '2' && counts[1] === '0'
    ? pass(`disjoint state: A=${counts[0]}, B=${counts[1]}`)
    : fail(`state leaked: ${JSON.stringify(counts)}`);

  // granted comms: B saw A's change via its subscribe grant
  const peerB = await frameB.evaluate(() => document.getElementById('peer').textContent);
  /widget\.tally\.a\.changed = 2/.test(peerB)
    ? pass('granted topic flowed A → B through the scoped bus')
    : fail(`peer view wrong: "${peerB}"`);

  // forbidden publish: dropped, and the denial is a visible event
  await frameA.click('#rogue');
  await page.waitForTimeout(300);
  const verdict = await page.evaluate(() => ({
    hijack: window.__events.some(e => e.topic === 'session.hijack'),
    denied: window.__events.find(e => e.topic === 'sys.guest.denied')?.data ?? null,
  }));
  !verdict.hijack && verdict.denied?.guest === 'a' && verdict.denied?.topic === 'session.hijack'
    ? pass('forbidden publish dropped; denial announced on the bus')
    : fail(`grant enforcement failed: ${JSON.stringify(verdict)}`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nGUEST E2E: FAIL' : '\nGUEST E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nGUEST E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
