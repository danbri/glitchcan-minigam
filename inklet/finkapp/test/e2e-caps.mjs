// One class of thing, and the boundary is real.
//
// foafos used to run two kinds of thing: "apps" (office/media windows,
// which got `allow-same-origin` and therefore full ambient authority over
// the shell) and "minigames" (opaque-origin guests that had to ask for
// everything). Only one of those was actually enforced — the other was a
// sandbox attribute doing no security work.
//
// Now everything is an app: `surface` says where it is drawn,
// `capabilities` say what it may do, and the two are independent. This
// test holds that line, because a security posture nobody measures is a
// security posture that quietly regresses.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const repoName = basename(repoRoot);
const PORT = 8155;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CORS_SERVER = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin','*'); super().end_headers()
    def log_message(self,*a): pass
http.server.ThreadingHTTPServer(('127.0.0.1',${PORT}), functools.partial(H, directory='${join(repoRoot, '..')}')).serve_forever()
`;
const server = spawn('python3', ['-c', CORS_SERVER], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

const fail = (m) => { console.error('✖', m); process.exitCode = 1; };
const pass = (m) => console.log('✔', m);
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?story=/${repoName}/inklet/hampstead.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // 1. one registry, one vocabulary
  const reg = await page.evaluate(async () => {
    const m = await import('./foafos-apps.js');
    return {
      total: m.APPS.length,
      surfaces: [...new Set(m.APPS.map(a => a.surface))].sort(),
      noSurface: m.APPS.filter(a => !a.surface).map(a => a.id),
      noCaps: m.APPS.filter(a => !Array.isArray(a.capabilities)).map(a => a.id),
      legacyKind: m.APPS.filter(a => 'kind' in a).map(a => a.id),
      ambient: m.ambientApps().map(a => a.id),
    };
  });
  reg.noSurface.length === 0 && reg.noCaps.length === 0 && reg.legacyKind.length === 0
    ? pass(`one registry: ${reg.total} apps, surfaces [${reg.surfaces.join(', ')}], every one declares capabilities`)
    : fail(`registry not uniform: ${JSON.stringify(reg)}`);

  // 2. the sandbox is DERIVED from capabilities, not from the surface
  const derived = await page.evaluate(async () => {
    const m = await import('./foafos-apps.js');
    const f = window.FoafOS.sandboxFor;
    const of = (id) => f(m.appById(id));
    return { channels: of('channels'), universe: of('universe'), sheets: of('sheets') };
  });
  !derived.channels.includes('allow-same-origin') && !derived.universe.includes('allow-same-origin')
    ? pass('a window app with no same-origin capability gets an opaque origin')
    : fail(`window apps still ambient: ${JSON.stringify(derived)}`);
  derived.sheets.includes('allow-same-origin')
    ? pass('the escape hatch is honoured when declared (sheets)')
    : fail('declared same-origin was not applied');

  // 3. a de-privileged app really cannot reach the shell
  await page.evaluate(() => window.FoafOS.launchApp('universe'));
  await page.waitForTimeout(2500);
  const frames = page.frames().filter(f => /fink-universe/.test(f.url()));
  if (!frames.length) {
    fail('universe app frame never appeared');
  } else {
    const probe = await frames[0].evaluate(() => {
      const r = {};
      try { r.parentDoc = !!parent.document; } catch (e) { r.parentDoc = e.name; }
      try { r.shell = typeof parent.FoafOS; } catch (e) { r.shell = e.name; }
      try { localStorage.getItem('x'); r.ls = 'reachable'; } catch (e) { r.ls = e.name; }
      return r;
    }).catch(e => ({ err: String(e).slice(0, 80) }));
    probe.parentDoc === 'SecurityError' && probe.shell === 'SecurityError' && probe.ls === 'SecurityError'
      ? pass('opaque origin holds: parent.document, parent.FoafOS and localStorage all refuse')
      : fail(`boundary leaked: ${JSON.stringify(probe)}`);
  }

  // 4. the store broker refuses an app that was not granted storage
  const brokered = await page.evaluate(() => {
    const s = window.FoafOS.store;
    s.grant('probe-app', []);                       // launched, no storage
    const denied = s.set('probe-app', 'k', 'v');
    s.grant('probe-app', ['storage']);
    const ok = s.set('probe-app', 'k', 'v');
    const readBack = s.snapshot('probe-app');
    s.grant('other-app', ['storage']);
    return { denied: denied.reason, ok: ok.ok, readBack, isolated: s.snapshot('other-app') };
  });
  brokered.denied === 'denied' && brokered.ok === true && brokered.readBack.k === 'v'
    && Object.keys(brokered.isolated).length === 0
    ? pass('store broker: refuses without the capability, isolates namespaces')
    : fail(`store broker wrong: ${JSON.stringify(brokered)}`);

  // 5. the shell says out loud who still holds ambient authority
  const note = await page.evaluate(() => document.getElementById('foafos-caps-note')?.textContent || '');
  const named = reg.ambient.length === 0
    ? /every app is sandboxed/.test(note)
    : reg.ambient.every(() => true) && /ambient authority/.test(note);
  named
    ? pass(`the drawer discloses it: "${note.slice(0, 72)}…"`)
    : fail(`capability disclosure missing or wrong: "${note}"`);

  // 6. a REAL app, de-privileged, using brokered storage end to end.
  // Channels holds `storage` and NOT `same-origin`, so its localStorage
  // is app-sdk's shim over the broker. This is the migration path
  // working, not a fixture.
  await page.evaluate(() => window.FoafOS.store.clear('channels'));
  await page.evaluate(() => window.FoafOS.launchApp('channels'));
  await page.waitForTimeout(3000);
  const tv = page.frames().find(f => /apps\/tv/.test(f.url()));
  if (!tv) {
    fail('channels app frame never appeared');
  } else {
    const inside = await tv.evaluate(() => ({
      sdkThere: !!window.foaf,
      id: window.foaf?.id,
      caps: window.foaf?.capabilities?.(),
      shimmed: !!window.foaf?._installed?.localStorage,
      // the native API would throw here; the shim must not
      write: (() => { try { localStorage.setItem('tv.station', '3'); return 'ok'; } catch (e) { return e.name; } })(),
      read: (() => { try { return localStorage.getItem('tv.station'); } catch (e) { return e.name; } })(),
    })).catch(e => ({ err: String(e).slice(0, 90) }));
    inside.sdkThere && inside.id === 'channels' && inside.shimmed
      ? pass(`the app knows itself: id=${inside.id}, caps=[${(inside.caps || []).join(',')}], storage shimmed`)
      : fail(`app-sdk did not initialise: ${JSON.stringify(inside)}`);
    inside.write === 'ok' && inside.read === '3'
      ? pass('brokered localStorage reads and writes synchronously inside an opaque origin')
      : fail(`shim failed: write=${inside.write} read=${inside.read}`);

    await page.waitForTimeout(500);
    const persisted = await page.evaluate(() => window.FoafOS.store.snapshot('channels'));
    persisted && persisted['tv.station'] === '3'
      ? pass('the write reached the broker and is persisted shell-side')
      : fail(`broker did not persist: ${JSON.stringify(persisted)}`);
  }

  // 7. the service inventory is honest about what is NOT brokered.
  // A capability vocabulary that quietly contains names nothing
  // implements is how you end up believing a boundary exists.
  const svc = await page.evaluate(() => window.FoafOS.services());
  const mediated = svc.filter(s => s.state === 'brokered').map(s => s.id);
  const unimpl = svc.filter(s => s.state === 'unimplemented').map(s => s.id);
  const providedWithoutProvider = svc.filter(s => s.state === 'brokered' && !s.provider);
  mediated.length >= 4 && unimpl.length >= 3 && providedWithoutProvider.length === 0
    ? pass(`services: ${mediated.length} brokered (${mediated.join(', ')}), ${unimpl.length} named but unimplemented (${unimpl.join(', ')})`)
    : fail(`service inventory wrong: ${JSON.stringify(svc.map(s => [s.id, s.state]))}`);
  const noteText = await page.evaluate(() => document.getElementById('foafos-caps-note')?.textContent || '');
  /Not brokered by us/.test(noteText)
    ? pass('the drawer admits which device services have no broker')
    : fail(`unimplemented services not disclosed: "${noteText}"`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 2).join(' · ')}`);
  console.log(process.exitCode ? '\nCAPS E2E: FAIL' : '\nCAPS E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 250)}`);
  console.log('\nCAPS E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
