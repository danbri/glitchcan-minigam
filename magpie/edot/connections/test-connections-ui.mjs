// test-connections-ui.mjs — headless UI test for <edot-connections>: the one
// surface that lists every account/provider across the suite. Reuses the
// storage-opfs Playwright/Chromium harness. Deterministic, no WebGL.
//
//   node magpie/edot/connections/test-connections-ui.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// This file lives at magpie/edot/connections/ — repo root is three levels up.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.ndjson': 'application/x-ndjson', '.gz': 'application/gzip' };
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
const base = `http://127.0.0.1:${port}/magpie/edot`;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${base}/connections/connections.html`);
  await page.waitForSelector('edot-connections .cx-acct');

  // 1) The local "device" account is listed under "On this device" with a LOCAL
  //    badge, a Storage chip, and "no login".
  const device = await page.evaluate(() => {
    const row = document.querySelector('edot-connections .cx-acct[data-id="device"]');
    if (!row) return null;
    const group = row.closest('.cx-group');
    return {
      present: true,
      groupTitle: group?.querySelector('.cx-group-h')?.textContent || '',
      hasLocalBadge: !!row.querySelector('.cx-badge-local'),
      noLogin: !!row.querySelector('.cx-auth-open') && /no login/i.test(row.querySelector('.cx-auth')?.textContent || ''),
      chips: [...row.querySelectorAll('.cx-chip')].map((c) => c.textContent.trim()),
    };
  });
  ok('local "device" account is listed', device && device.present);
  ok('device account is grouped under "On this device"', device && /on this device/i.test(device.groupTitle));
  ok('device account shows a LOCAL badge', device && device.hasLocalBadge);
  ok('device account shows "no login"', device && device.noLogin);
  ok('device account has a Storage capability chip', device && device.chips.some((t) => /storage/i.test(t)));

  // 2) The provider picker (Add connection) lists platforms grouped from PROVIDERS.
  await page.click('edot-connections .cx-add-btn');
  await page.waitForSelector('edot-connections .cx-prov-pick');
  const picker = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('edot-connections .cx-picker-group')].map((g) => ({
      legend: g.querySelector('legend')?.textContent || '',
      providers: [...g.querySelectorAll('.cx-prov-pick')].map((b) => b.dataset.provider),
    }));
    const platforms = groups.find((g) => /platform/i.test(g.legend));
    const onDevice = groups.find((g) => /on this device/i.test(g.legend));
    return { groups, platforms, onDevice };
  });
  ok('picker groups providers by kind (On this device vs Platforms)', picker.onDevice && picker.platforms);
  ok('Platforms group lists GitHub and Gmail', picker.platforms && picker.platforms.providers.includes('github') && picker.platforms.providers.includes('gmail'));
  ok('On-this-device group lists the OPFS/local providers', picker.onDevice && picker.onDevice.providers.includes('opfs') && picker.onDevice.providers.includes('local-fs'));

  // 3) Selecting GitHub shows it offers storage + vcs and needs oauth (with an
  //    honest "not wired up" TODO note — no fake successful connection).
  await page.click('edot-connections .cx-prov-pick[data-provider="github"]');
  await page.waitForSelector('edot-connections .cx-detail-card');
  const gh = await page.evaluate(() => {
    const card = document.querySelector('edot-connections .cx-detail-card');
    const offers = [...card.querySelectorAll('.cx-detail-offers .cx-chip')].map((c) => c.textContent.trim());
    return {
      title: card.querySelector('.cx-detail-title')?.textContent || '',
      offersStorage: offers.some((t) => /storage/i.test(t)),
      offersVcs: offers.some((t) => /version control|vcs/i.test(t)),
      mentionsOauth: /oauth|sign in/i.test(card.textContent),
      hasTodo: !!card.querySelector('.cx-todo'),
      connectDisabled: !!card.querySelector('.cx-connect[disabled]'),
    };
  });
  ok('selecting GitHub shows its provider detail', /github/i.test(gh.title));
  ok('GitHub detail shows it offers storage', gh.offersStorage);
  ok('GitHub detail shows it offers version control (vcs)', gh.offersVcs);
  ok('GitHub detail shows it needs OAuth sign-in', gh.mentionsOauth);
  ok('GitHub (remote) shows an honest TODO + disabled Connect (no fake success)', gh.hasTodo && gh.connectDisabled);

  // 4) Adding a second account via getConnections().add(...) and publishing
  //    'connections:changed' makes the list re-render to include it.
  const added = await page.evaluate(async (b) => {
    const { getConnections } = await import(`${b}/js/connections.js`);
    const { MemoryResourceSource } = await import(`${b}/js/resource-source.js`);
    const conn = getConnections();
    // conn.add() publishes 'connections:changed' on the kernel bus itself.
    conn.add({ id: 'work-dav', provider: 'webdav', label: 'Work WebDAV', sources: { storage: new MemoryResourceSource({ provider: 'webdav' }) } });
    return true;
  }, base);
  ok('add() ran', added);
  await page.waitForSelector('edot-connections .cx-acct[data-id="work-dav"]', { timeout: 4000 });
  const work = await page.evaluate(() => {
    const row = document.querySelector('edot-connections .cx-acct[data-id="work-dav"]');
    if (!row) return null;
    const group = row.closest('.cx-group');
    return {
      label: row.querySelector('.cx-acct-label')?.textContent || '',
      groupTitle: group?.querySelector('.cx-group-h')?.textContent || '',
      remoteBadge: !!row.querySelector('.cx-badge-remote'),
      authNeeded: !!row.querySelector('.cx-auth-needed'),
    };
  });
  ok('list re-rendered to include the newly added account', work && /work webdav/i.test(work.label));
  ok('new platform account is grouped under "Platforms"', work && /platform/i.test(work.groupTitle));
  ok('new platform account shows a PLATFORM badge', work && work.remoteBadge);
  ok('new platform account shows "sign-in needed"', work && work.authNeeded);

  // 5) The Identity axis: attaching signed-in OIDC identities surfaces a
  //    "Signed in" section listing them, with the active one marked CURRENT.
  await page.evaluate(async (b) => {
    const { getConnections } = await import(`${b}/js/connections.js`);
    const conn = getConnections();
    const accts = [
      { key: 'google:111', sub: '111', provider: 'google', providerName: 'Google', name: 'Ada Lovelace', email: 'ada@example.com', picture: null },
    ];
    conn.attachIdentities({
      activeSub: 'google:111',
      list: () => accts.slice(),
      active: () => accts[0],
      addEventListener() {},
    });
    // attachIdentities publishes 'connections:changed' → refresh().
  }, base);
  await page.waitForSelector('edot-connections .cx-group-identity .cx-identity', { timeout: 4000 });
  const ident = await page.evaluate(() => {
    const sec = document.querySelector('edot-connections .cx-group-identity');
    const row = sec?.querySelector('.cx-identity');
    return {
      heading: sec?.querySelector('.cx-group-h')?.textContent || '',
      name: row?.querySelector('.cx-id-name')?.textContent || '',
      meta: row?.querySelector('.cx-id-meta')?.textContent || '',
      active: !!row?.classList.contains('cx-identity-active'),
      currentBadge: !!row?.querySelector('.cx-badge'),
    };
  });
  ok('signed-in identities render under a "Signed in" heading', /signed in/i.test(ident.heading));
  ok('the identity shows its name', /ada lovelace/i.test(ident.name));
  ok('the identity shows email + provider', /ada@example\.com/i.test(ident.meta) && /google/i.test(ident.meta));
  ok('the active identity is marked CURRENT', ident.active && ident.currentBadge);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs.slice(0, 4));
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nCONNECTIONS-UI FAIL' : '\nCONNECTIONS-UI OK');
process.exit(fail ? 1 : 0);
