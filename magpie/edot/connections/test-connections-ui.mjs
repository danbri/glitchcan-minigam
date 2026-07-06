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

  // 3) Selecting GitHub shows it offers storage + vcs and a real connect form
  //    (repo/branch/token), not a disabled TODO.
  await page.click('edot-connections .cx-prov-pick[data-provider="github"]');
  await page.waitForSelector('edot-connections .cx-detail-card');
  const gh = await page.evaluate(() => {
    const card = document.querySelector('edot-connections .cx-detail-card');
    const offers = [...card.querySelectorAll('.cx-detail-offers .cx-chip')].map((c) => c.textContent.trim());
    return {
      title: card.querySelector('.cx-detail-title')?.textContent || '',
      offersStorage: offers.some((t) => /storage/i.test(t)),
      offersVcs: offers.some((t) => /version control|vcs/i.test(t)),
      hasRepoField: !!card.querySelector('[name="gh-repo"]'),
      hasTokenField: !!card.querySelector('[name="gh-token"]'),
      connectEnabled: !!card.querySelector('.cx-connect:not([disabled])'),
    };
  });
  ok('selecting GitHub shows its provider detail', /github/i.test(gh.title));
  ok('GitHub detail shows it offers storage', gh.offersStorage);
  ok('GitHub detail shows it offers version control (vcs)', gh.offersVcs);
  ok('GitHub offers a real connect form (repo + token), connect enabled', gh.hasRepoField && gh.hasTokenField && gh.connectEnabled);

  // 3b) WebDAV is also wired for real: it shows a connect form (URL + user +
  //     password), not a TODO.
  await page.click('edot-connections .cx-prov-pick[data-provider="webdav"]');
  await page.waitForSelector('edot-connections [name="dav-url"]');
  ok('WebDAV offers a real connect form (URL + credentials), connect enabled', await page.evaluate(() => {
    const card = document.querySelector('edot-connections .cx-detail-card');
    return !!card.querySelector('[name="dav-url"]') && !!card.querySelector('[name="dav-pass"]') && !!card.querySelector('.cx-connect:not([disabled])');
  }));

  // 3c) A still-unwired remote (S3) keeps the honest TODO + disabled Connect.
  await page.click('edot-connections .cx-prov-pick[data-provider="s3"]');
  await page.waitForSelector('edot-connections .cx-detail-card .cx-todo');
  ok('an unwired remote (S3) shows an honest TODO + disabled Connect', await page.evaluate(() => {
    const card = document.querySelector('edot-connections .cx-detail-card');
    return !!card.querySelector('.cx-todo') && !!card.querySelector('.cx-connect[disabled]');
  }));

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

  // 6) Connect a REAL GitHub mount: stub api.github.com, fill the form, Connect,
  //    then write+read a document through the registered storage source. Proves
  //    the remote mount is wired end-to-end (request shaping; no live network).
  await page.evaluate(() => {
    const files = new Map(); window.__ghfiles = files; let sha = 0;
    const res = (s, j) => ({ ok: s >= 200 && s < 300, status: s, async text() { return JSON.stringify(j); } });
    window.fetch = (url, opts = {}) => {
      const u = new URL(url, location.href);
      if (!/api\.github\.com$/.test(u.host)) return Promise.resolve(res(404, { message: 'nf' }));
      const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.*))?$/);
      const method = opts.method || 'GET';
      if (!m) return Promise.resolve(res(404, { message: 'nf' }));
      if (m[3] == null) return Promise.resolve(res(200, { full_name: `${m[1]}/${m[2]}`, default_branch: 'main' }));
      const key = decodeURIComponent(m[3]).replace(/^\/+/, '');
      if (method === 'GET') {
        if (files.has(key)) { const f = files.get(key); return Promise.resolve(res(200, { type: 'file', encoding: 'base64', content: f.b64, sha: f.sha, size: atob(f.b64).length, path: key, name: key.split('/').pop() })); }
        const prefix = key === '' ? '' : key + '/'; const ch = new Map();
        for (const k of files.keys()) { if (prefix && !k.startsWith(prefix)) continue; const rest = k.slice(prefix.length); if (!rest) continue; const seg = rest.split('/')[0]; ch.set(seg, rest.includes('/') ? { type: 'dir' } : { type: 'file', sha: files.get(k).sha }); }
        if (ch.size) return Promise.resolve(res(200, [...ch.entries()].map(([nm, info]) => ({ name: nm, path: prefix + nm, type: info.type, sha: info.sha, size: 0 }))));
        return Promise.resolve(res(404, { message: 'nf' }));
      }
      if (method === 'PUT') { const b = JSON.parse(opts.body); files.set(key, { b64: b.content, sha: 's' + (++sha) }); return Promise.resolve(res(b.sha ? 200 : 201, { content: { path: key, sha: files.get(key).sha } })); }
      if (method === 'DELETE') { files.delete(key); return Promise.resolve(res(200, {})); }
      return Promise.resolve(res(400, { message: 'bad' }));
    };
  });
  const addOpen = await page.evaluate(() => !document.querySelector('edot-connections .cx-add').hidden);
  if (!addOpen) await page.click('edot-connections .cx-add-btn');
  await page.click('edot-connections .cx-prov-pick[data-provider="github"]');
  await page.waitForSelector('edot-connections [name="gh-repo"]');
  await page.fill('edot-connections [name="gh-repo"]', 'danbri/glitchcan-minigam');
  await page.fill('edot-connections [name="gh-token"]', 'ghp_testtoken');
  await page.click('edot-connections .cx-connect');
  await page.waitForSelector('edot-connections .cx-acct[data-id^="github-"]', { timeout: 5000 });
  const ghAcct = await page.evaluate(() => {
    const row = document.querySelector('edot-connections .cx-acct[data-id^="github-"]');
    return { label: row?.querySelector('.cx-acct-label')?.textContent || '', remote: !!row?.querySelector('.cx-badge-remote'), hasStorageChip: [...row.querySelectorAll('.cx-chip')].some((c) => /storage/i.test(c.textContent)) };
  });
  ok('connecting GitHub registers it as a platform account', /github · danbri/i.test(ghAcct.label) && ghAcct.remote);
  ok('the GitHub account offers a storage capability', ghAcct.hasStorageChip);
  const rt = await page.evaluate(async () => {
    const { getKernel } = await import('../js/edot-kernel.js');
    const k = getKernel();
    const acct = k.capabilities.invoke('connections.list', { capability: 'storage' }).find((a) => a.provider === 'github');
    const src = k.capabilities.invoke('storage.source', { id: acct.id });
    await src.write('/docs/hello.md', new TextEncoder().encode('# hi from connections'));
    return new TextDecoder().decode(await src.read('/docs/hello.md'));
  });
  ok('the connected GitHub mount writes + reads through the storage interface', /hi from connections/.test(rt));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs.slice(0, 4));
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nCONNECTIONS-UI FAIL' : '\nCONNECTIONS-UI OK');
process.exit(fail ? 1 : 0);
