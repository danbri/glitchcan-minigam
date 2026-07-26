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
    return { channels: of('channels'), universe: of('universe'), hatch: of('robbamp') };
  });
  !derived.channels.includes('allow-same-origin') && !derived.universe.includes('allow-same-origin')
    ? pass('a window app with no same-origin capability gets an opaque origin')
    : fail(`window apps still ambient: ${JSON.stringify(derived)}`);
  derived.hatch.includes('allow-same-origin')
    ? pass('the escape hatch is honoured when declared (robbamp — the last holder)')
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

  // 8. a declared capability list that constrains NOTHING must say so.
  // Stories run in the host page (FinkInkEngine/FinkPlayer/FinkUI are
  // globals), so their lists describe rather than limit. The failure this
  // guards against is a list that reads like a boundary and is not one.
  const unenf = await page.evaluate(async () => {
    const m = await import('./foafos-apps.js');
    return m.unenforcedApps().map(a => ({ id: a.id, surface: a.surface, caps: a.capabilities }));
  });
  const storiesAllUnenforced = await page.evaluate(async () => {
    const m = await import('./foafos-apps.js');
    return m.APPS.filter(a => a.surface === 'story').every(a => a.enforced === false);
  });
  unenf.length > 0 && storiesAllUnenforced && unenf.every(a => a.caps.length > 0)
    ? pass(`unenforced lists are flagged: ${unenf.map(a => a.id).join(', ')} (story surface runs in the host page)`)
    : fail(`story privilege not declared honestly: ${JSON.stringify(unenf)}`);
  const note2 = await page.evaluate(() => document.getElementById('foafos-caps-note')?.textContent || '');
  /description, not a limit/.test(note2)
    ? pass('the drawer says the story lists do not constrain')
    : fail(`story privilege not disclosed: "${note2.slice(-90)}"`);

  // 9. a MIGRATED Office app: no same-origin, real work, data survives.
  // Channels proved the shim on an app that barely stored anything.
  // Calendar is the real test — it used IndexedDB, which an opaque origin
  // refuses outright, so it had to gain a brokered fallback to come off
  // the escape hatch. This is the ambient-authority count dropping by one.
  await page.evaluate(() => window.FoafOS.store.clear('calendar'));
  await page.evaluate(() => window.FoafOS.launchApp('calendar'));
  await page.waitForTimeout(4000);
  const cal = page.frames().find(f => /calendar\.html/.test(f.url()));
  if (!cal) {
    fail('calendar app frame never appeared');
  } else {
    const st = await cal.evaluate(async () => {
      const r = { boundary: null, broker: null, wrote: null, readBack: null };
      try { parent.document; r.boundary = 'reachable'; } catch (e) { r.boundary = e.name; }
      // it must have noticed IDB is refused and fallen back
      for (let i = 0; i < 40 && !window.__cal; i++) await new Promise(z => setTimeout(z, 250));
      r.broker = window.__cal?.store?.usingBroker ?? 'no hook';
      if (window.__cal?.store) {
        const s = window.__cal.store;
        await s.putCalendar({ id: 'c1', name: 'Work' });
        await s.putEvent({ id: 'e1', calendarId: 'c1', title: 'Standup',
                           start: new Date('2026-08-01T09:00:00Z'), end: new Date('2026-08-01T09:15:00Z') });
        r.wrote = true;
        const evs = await s.getEventsFor('c1');
        r.readBack = evs.length === 1 && evs[0].title === 'Standup' && evs[0].start instanceof Date;
      }
      return r;
    }).catch(e => ({ err: String(e).slice(0, 110) }));

    st.boundary === 'SecurityError'
      ? pass('calendar runs de-privileged: parent.document refuses')
      : fail(`calendar still has ambient authority: ${JSON.stringify(st)}`);
    st.broker === true
      ? pass('it noticed IndexedDB is refused and fell back to the broker')
      : fail(`calendar did not fall back: usingBroker=${JSON.stringify(st.broker)}`);
    st.wrote === true && st.readBack === true
      ? pass('a calendar and an event round-trip through the broker, Dates rehydrated')
      : fail(`round-trip failed: ${JSON.stringify(st)}`);

    const persisted = await page.evaluate(() => window.FoafOS.store.snapshot('calendar'));
    persisted && Object.keys(persisted).some(k => k.includes('calendar'))
      ? pass(`the shell holds calendar's bytes (${Object.keys(persisted).join(', ')})`)
      : fail(`nothing reached the broker: ${JSON.stringify(persisted)}`);
  }

  // 10. Files: the second migration, and a different flavour of refusal.
  // Files stores nothing of its own — its escape hatch was bought for OPFS,
  // which needs an origin to hang a storage bucket on and is therefore
  // refused outright in a sandboxed frame. So the fallback here is a whole
  // ResourceSource, not a key/value store.
  //
  // Fixing this also uncovered that the app had NEVER loaded inside the
  // shell: the registry pointed at the directory, which has no index.html,
  // so the frame showed a directory listing locally and would 404 on Pages.
  // Hence the assertion that the custom element is actually there.
  await page.evaluate(() => window.FoafOS.store.clear('files'));
  await page.evaluate(() => window.FoafOS.launchApp('files'));
  await page.waitForTimeout(4000);
  const filesFrame = page.frames().find(f => /edot\/files\//.test(f.url()));
  if (!filesFrame) {
    fail('files app frame never appeared');
  } else {
    const st = await filesFrame.evaluate(async () => {
      const r = { element: false, boundary: null, brokered: null, wrote: null, listed: null };
      for (let i = 0; i < 40; i++) {
        const el = document.querySelector('edot-files');
        if (el?.mount) { r.element = true; r.brokered = !!el.mount.brokered; break; }
        await new Promise(z => setTimeout(z, 250));
      }
      try { parent.document; r.boundary = 'reachable'; } catch (e) { r.boundary = e.name; }
      const el = document.querySelector('edot-files');
      if (el?.mount) {
        await el.mount.write('/notes/todo.txt', new TextEncoder().encode('brokered bytes'));
        r.wrote = true;
        r.listed = (await el.mount.list('/', { offset: 0, limit: 10 })).map(e => e.name);
      }
      return r;
    }).catch(e => ({ err: String(e).slice(0, 110) }));

    st.element === true
      ? pass('files actually loads inside the shell (it never did before)')
      : fail(`no <edot-files> in the frame: ${JSON.stringify(st)}`);
    st.boundary === 'SecurityError'
      ? pass('files runs de-privileged: parent.document refuses')
      : fail(`files still has ambient authority: ${JSON.stringify(st)}`);
    st.brokered === true
      ? pass('OPFS is refused here, so it mounted the brokered ResourceSource')
      : fail(`files did not fall back: brokered=${JSON.stringify(st.brokered)}`);
    Array.isArray(st.listed) && st.listed.includes('notes')
      ? pass(`a write shows up in the listing (${st.listed.join(', ')})`)
      : fail(`write did not land: ${JSON.stringify(st)}`);

    const held = await page.evaluate(() => window.FoafOS.store.snapshot('files'));
    held && Object.keys(held).length
      ? pass(`the shell holds files' bytes (${Object.keys(held).join(', ')})`)
      : fail(`nothing reached the broker: ${JSON.stringify(held)}`);
  }

  // 11. edot itself. Its `same-origin` was cargo cult: no iframes to reach
  // into, every localStorage call already try-wrapped, and Library.create()
  // already tried IndexedDB and fell back to a localStorage backend. All it
  // needed was somewhere for that fallback to land. Worth asserting rather
  // than assuming, because "it looked like it didn't need it" is exactly
  // the reasoning that puts an escape hatch there in the first place.
  await page.evaluate(() => window.FoafOS.store.clear('edot'));
  await page.evaluate(() => window.FoafOS.launchApp('edot'));
  await page.waitForTimeout(4000);
  const edotFrame = page.frames().find(f => /edot\.html/.test(f.url()));
  if (!edotFrame) {
    fail('edot frame never appeared');
  } else {
    const st = await edotFrame.evaluate(async () => {
      const r = { boundary: null, shimmed: null, ui: false };
      try { parent.document; r.boundary = 'reachable'; } catch (e) { r.boundary = e.name; }
      r.shimmed = Object.prototype.hasOwnProperty.call(window, 'localStorage');
      for (let i = 0; i < 30; i++) {
        if (document.querySelector('edot-editor, .edot-app, main')) { r.ui = true; break; }
        await new Promise(z => setTimeout(z, 200));
      }
      return r;
    }).catch(e => ({ err: String(e).slice(0, 110) }));

    st.boundary === 'SecurityError' && st.shimmed === true
      ? pass('edot runs de-privileged, with localStorage standing in for it')
      : fail(`edot still has ambient authority: ${JSON.stringify(st)}`);
    st.ui === true ? pass('and its UI comes up') : fail('edot rendered nothing');

    const held = await page.evaluate(() => Object.keys(window.FoafOS.store.snapshot('edot') || {}));
    held.includes('edot.library.v1')
      ? pass(`the shell holds edot's document library (${held.length} keys)`)
      : fail(`library did not reach the broker: ${JSON.stringify(held)}`);
  }

  // 11b. app-sdk must not touch a working localStorage.
  //
  // It used to install its shim unconditionally, so every page that loaded
  // app-sdk in order to run under foafos LOST its real localStorage when
  // opened standalone — replaced by a shim that throws
  // FoafCapabilityError, because nothing had granted it anything. Apps
  // whose storage calls are try-wrapped (edot's are, all of them) simply
  // stopped remembering things, silently. Data's own standalone suite
  // caught it; nothing in this file would have.
  //
  // The shell page itself is same-origin and loads no app-sdk, so this
  // checks the rule where it is cheap to check: a top-level page with a
  // working localStorage keeps the native one.
  {
    const probe = await page.evaluate(async () => {
      const r = {};
      const before = localStorage.getItem('__caps_probe__');
      // load app-sdk into THIS (same-origin, working-storage) page
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = '../apps/app-sdk.js';
        s.onload = res; s.onerror = () => rej(new Error('app-sdk did not load'));
        document.head.appendChild(s);
      });
      // NB: hasOwnProperty('localStorage') is true on an ordinary page in
      // this browser, so it does not discriminate. What matters is whether
      // app-sdk installed anything, and whether the real API still works.
      r.installed = window.foaf?._installed?.localStorage;
      try { localStorage.setItem('__caps_probe__', 'still-native'); r.write = localStorage.getItem('__caps_probe__'); }
      catch (e) { r.write = e.name; }
      localStorage.removeItem('__caps_probe__');
      if (before !== null) localStorage.setItem('__caps_probe__', before);
      return r;
    }).catch(e => ({ err: String(e).slice(0, 110) }));

    probe.installed === false && probe.write === 'still-native'
      ? pass('app-sdk leaves a WORKING localStorage alone (standalone apps keep theirs)')
      : fail(`app-sdk clobbered native storage: ${JSON.stringify(probe)}`);
  }

  // 12. Data: the heaviest of them, and the one where a silent failure
  // costs most. It keeps a whole SQLite file, in IndexedDB, which an
  // opaque origin refuses to open — so the engine picks a backend by
  // trying and falls back to the same blob base64'd through the broker.
  // Also the reason FoafStore grew per-app quotas: an almost-empty SQLite
  // database is already ~43KB encoded, against a 256KB default.
  await page.evaluate(() => { window.FoafOS.store.clear('sheets'); window.FoafOS.launchApp('sheets'); });
  await page.waitForTimeout(6000);
  const dataFrame = page.frames().find(f => /data\.html/.test(f.url()));
  if (!dataFrame) {
    fail('data app frame never appeared');
  } else {
    const st = await dataFrame.evaluate(async () => {
      const r = { boundary: null, kind: null, why: null, rows: null, err: null };
      try { parent.document; r.boundary = 'reachable'; } catch (e) { r.boundary = e.name; }
      let eng = null;
      for (let i = 0; i < 60; i++) {
        eng = document.querySelector('edot-data')?.engine || window.__data?.engine;
        if (eng?.storageKind) break;
        await new Promise(z => setTimeout(z, 250));
      }
      if (!eng) return r;
      r.kind = eng.storageKind; r.why = eng.storageWhy;
      eng.run('CREATE TABLE IF NOT EXISTS probe (a TEXT)');
      eng.run("INSERT INTO probe VALUES ('brokered')");
      await eng._persistNow();
      r.rows = eng.query('SELECT a FROM probe').rows.flat();
      r.err = eng.storageError;
      return r;
    }).catch(e => ({ err: String(e).slice(0, 110) }));

    st.boundary === 'SecurityError'
      ? pass('data runs de-privileged: parent.document refuses')
      : fail(`data still has ambient authority: ${JSON.stringify(st)}`);
    st.kind === 'broker'
      ? pass(`IndexedDB is refused here, so it fell back ("${String(st.why).slice(0, 58)}…")`)
      : fail(`data did not fall back: kind=${JSON.stringify(st.kind)}`);
    Array.isArray(st.rows) && st.rows.includes('brokered') && !st.err
      ? pass('SQL runs and the database persists with no error')
      : fail(`data round-trip failed: ${JSON.stringify(st)}`);

    const blob = await page.evaluate(() => {
      const s = window.FoafOS.store.snapshot('sheets') || {};
      return { keys: Object.keys(s), bytes: (s['edot.data.db'] || '').length,
               quota: window.FoafOS.store.quotaFor('sheets') };
    });
    blob.bytes > 1000 && blob.quota > 256 * 1024
      ? pass(`the shell holds the database (${Math.round(blob.bytes / 1024)}KB of a ${Math.round(blob.quota / 1024)}KB allowance)`)
      : fail(`database did not reach the broker: ${JSON.stringify(blob)}`);
  }

  // 13. Secrets are not storage. Measured before this existed: edot's
  // "stay signed in" put a bearer token in `foafos.store.edot`, in
  // plaintext, ON DISK, in the shell's origin — because reading back what
  // you wrote is what a storage broker is FOR, which is exactly why a
  // credential must not live in one. FoafSecrets is the same shape with a
  // deliberately worse interface: put, name, use, and NO get.
  {
    // Channels holds `storage` but NOT `secrets`, so it is the refusal
    // case — and the refusal is the more important half of the design.
    const noCap = await page.evaluate(async () => {
      const S = window.FoafOS.secrets;
      return { put: S.put('channels', 'gh.token', 'nope').reason, names: S.names('channels') };
    });
    noCap.put === 'denied' && noCap.names === null
      ? pass('an app with storage but not secrets is refused (and names is null, not empty)')
      : fail(`secrets granted too widely: ${JSON.stringify(noCap)}`);

    // edot DOES declare it — its GitHub-backed saving really holds a token.
    await page.evaluate(() => window.FoafOS.launchApp('edot'));
    await page.waitForTimeout(4000);
    const app = page.frames().find(f => /edot\.html/.test(f.url()));
    if (!app) {
      fail('edot frame never appeared for the secrets probe');
    } else {
      const r = await app.evaluate(async () => {
        const out = {};
        out.hasApi = typeof window.foaf?.secrets?.put === 'function';
        out.put = await window.foaf.secrets.put('gh.token', 'gho_E2E_SECRET_TOKEN');
        out.names = await window.foaf.secrets.names();
        // the whole point: there is no way back
        try { window.foaf.secrets.get('gh.token'); out.get = 'returned'; }
        catch (e) { out.get = e.name; }
        // and asking the shell directly is refused too
        out.askedShell = await new Promise((res) => {
          const on = (ev) => {
            if (ev.data?.type === 'secrets.refused') { window.removeEventListener('message', on); res(ev.data.reason); }
          };
          window.addEventListener('message', on);
          parent.postMessage({ type: 'secrets.get', name: 'gh.token', rid: 'probe' }, '*');
          setTimeout(() => res('no answer'), 2500);
        });
        return out;
      }).catch(e => ({ err: String(e).slice(0, 120) }));

      r.hasApi && r.put?.ok === true && Array.isArray(r.names) && r.names.includes('gh.token')
        ? pass('an app can hand the shell a secret and list its own names')
        : fail(`secrets put/names failed: ${JSON.stringify(r)}`);
      r.get === 'FoafSecretsNotReadable' && r.askedShell === 'not-readable'
        ? pass('and cannot read it back — refused in the SDK and again by the shell')
        : fail(`a secret was readable: ${JSON.stringify(r)}`);

      const shellSide = await page.evaluate(async () => {
        const S = window.FoafOS.secrets;
        const used = await S.use('edot', 'gh.token', (v) => `saw ${v.length} chars`);
        return {
          report: S.report(),
          sealed: S.sealed,
          used,
          // it must NOT have leaked into the storage broker or the bus
          inStore: JSON.stringify(window.FoafOS.store.snapshot('edot') || {}).includes('gho_E2E_SECRET_TOKEN'),
          onDisk: Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes('gho_E2E_SECRET_TOKEN')),
          inAudit: JSON.stringify(S.audit).includes('gho_E2E_SECRET_TOKEN'),
        };
      });
      shellSide.used?.ok === true && /saw 20 chars/.test(String(shellSide.used.result))
        ? pass('the SHELL can use it without the app ever seeing the value')
        : fail(`shell-side use failed: ${JSON.stringify(shellSide.used)}`);
      (!shellSide.inStore && !shellSide.onDisk && !shellSide.inAudit)
        ? pass('the value is not in the store, not on disk, not in the audit')
        : fail(`the secret leaked: ${JSON.stringify(shellSide)}`);
      shellSide.sealed === false
        ? pass('and with no session passphrase it says plainly that it is unsealed')
        : fail('claimed sealed without a passphrase');
    }
  }

  // 14. The verb side: broker the ACTION, not the token. Taking `get` away
  // left the obvious question — what does "use it" MEAN? If the answer were
  // "run this function I'm handing you", the whole thing was theatre. So the
  // app sends a verb NAME and data, and the shell decides what that means
  // and where it points.
  //
  // api.github.com is intercepted rather than injected, so the shell's own
  // `fetch` is what runs and the assertions are about real requests leaving
  // the page. (No egress here anyway — but a stub in place of fetch would
  // not have proved the wiring.)
  {
    const seen = [];
    await page.route('https://api.github.com/**', async (route) => {
      const req = route.request();
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
        'Access-Control-Allow-Headers': 'authorization,content-type,accept,x-github-api-version',
      };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      seen.push({ method: req.method(), url: req.url(), auth: req.headers()['authorization'] || null, body: req.postData() });
      if (req.method() === 'GET') {
        return route.fulfill({ status: 404, headers: { ...cors, 'Content-Type': 'application/json' }, body: '{"message":"Not Found"}' });
      }
      return route.fulfill({
        status: 201, headers: { ...cors, 'Content-Type': 'application/json' },
        // GitHub's own error bodies quote the token; include one here so the
        // "no body reaches the app" claim is tested against the real shape.
        body: JSON.stringify({ content: { sha: 'blob1', html_url: 'https://github.com/x/y/blob/main/a.md' }, commit: { sha: 'c1' }, message: 'token was gho_E2E_VERB_TOKEN' }),
      });
    });

    // Unaimed first: holding `git:write` with no destination configured must
    // do nothing at all. A verb aimed nowhere is the correct default for
    // something that writes to someone's repo.
    const app2 = page.frames().find(f => /edot\.html/.test(f.url()));
    if (!app2) {
      fail('edot frame never appeared for the verb probe');
    } else {
      const unaimed = await app2.evaluate(async () => {
        await window.foaf.secrets.put('git.token', 'gho_E2E_VERB_TOKEN');
        return {
          verbs: await window.foaf.verbs(),
          tried: await window.foaf.invoke('git.commit', { path: 'edot/a.md', content: 'hi' }),
        };
      }).catch(e => ({ err: String(e).slice(0, 150) }));
      unaimed.tried?.reason === 'denied' && (unaimed.verbs || []).length === 0
        ? pass('a verb with no destination configured is refused, and not even listed')
        : fail(`an unaimed verb was callable: ${JSON.stringify(unaimed)}`);

      // Now point it somewhere. This is shell-side configuration — the app
      // has no say in it, which is the entire security property.
      const aimed = await page.evaluate(() => window.FoafOS.aimOp('edot', 'git:write',
        { repo: 'danbri/e2e-notes', branch: 'main', pathPrefix: 'edot/' }));
      aimed?.ok === true ? pass('the shell can aim a verb at a repo')
        : fail(`aimOp refused a valid scope: ${JSON.stringify(aimed)}`);

      const r = await app2.evaluate(async () => ({
        verbs: (await window.foaf.verbs()).map(v => v.verb),
        done: await window.foaf.invoke('git.commit', { path: 'edot/a.md', content: 'hello from a sandbox', message: 'e2e' }),
        // every attempt to choose the destination itself
        elsewhere: await window.foaf.invoke('git.commit', {
          path: 'edot/b.md', content: 'x', repo: 'attacker/loot', owner: 'attacker', branch: 'gh-pages',
        }),
        outside: await window.foaf.invoke('git.commit', { path: '.github/workflows/evil.yml', content: 'x' }),
        traversal: await window.foaf.invoke('git.commit', { path: 'edot/../.github/evil.yml', content: 'x' }),
        unknown: await window.foaf.invoke('rm.rf', {}),
      })).catch(e => ({ err: String(e).slice(0, 150) }));

      r.done?.ok === true && r.done.sha === 'blob1' && r.verbs?.includes('git.commit')
        ? pass('a sandboxed app committed a file it has no credential for')
        : fail(`the verb did not run: ${JSON.stringify(r)}`);
      r.outside?.reason === 'bad-params' && r.traversal?.reason === 'bad-params' && r.unknown?.reason === 'unknown-verb'
        ? pass('outside the prefix, traversal and unknown verbs are named refusals')
        : fail(`a refusal was wrong: ${JSON.stringify({ o: r.outside, t: r.traversal, u: r.unknown })}`);

      const puts = seen.filter(c => c.method === 'PUT');
      seen.length > 0 && seen.every(c => c.url.startsWith('https://api.github.com/repos/danbri/e2e-notes/'))
        ? pass(`all ${seen.length} request(s) went to the granted repo, not the one the app asked for`)
        : fail(`a request escaped the grant: ${seen.map(c => c.url).join(', ')}`);
      puts.length && puts.every(c => JSON.parse(c.body).branch === 'main')
        ? pass('the branch came from the grant too')
        : fail('the branch was not the granted one');
      puts.some(c => String(c.auth).includes('gho_E2E_VERB_TOKEN'))
        ? pass('the shell attached the credential the app cannot read')
        : fail('the request went out without the token');

      // …and the app is no closer to holding it than before.
      const clean = await app2.evaluate(() => ({
        result: JSON.stringify(window.__lastVerb || {}),
        anywhere: JSON.stringify({ ls: (() => { try { return { ...localStorage }; } catch (_) { return {}; } })() }),
      }));
      const leaked = await page.evaluate((tok) => ({
        bus: (window.FoafOS.ops.audit || []).some(a => JSON.stringify(a).includes(tok)),
        store: JSON.stringify(window.FoafOS.store.snapshot('edot') || {}).includes(tok),
      }), 'gho_E2E_VERB_TOKEN');
      !leaked.bus && !leaked.store
        && !JSON.stringify(r.done).includes('gho_E2E_VERB_TOKEN')
        && !clean.anywhere.includes('gho_E2E_VERB_TOKEN')
        ? pass("the token is in the request and nowhere else — not the result, not the audit, not the app's keyspace")
        : fail(`the token leaked: ${JSON.stringify({ leaked, clean: clean.anywhere.slice(0, 120) })}`);
      !JSON.stringify(r.done).includes('token was')
        ? pass("GitHub's response body is not passed through (it quotes credentials)")
        : fail('the whole API response reached the app');

      // A saved destination must not resurrect a capability the tree denied.
      const notGranted = await page.evaluate(() => {
        window.FoafOS.aimOp('channels', 'git:write', { repo: 'danbri/e2e-notes' });
        window.FoafOS.aimVerbsFor('channels', ['storage', 'audio']);   // what it really holds
        return window.FoafOS.ops.can('channels', 'git.commit');
      });
      notGranted === false
        ? pass('a saved destination does not resurrect a capability the app tree denied')
        : fail('an ungranted app could call a verb because a scope was configured');

      // The Publishing panel is what makes any of this reachable by a
      // person. Both halves belong to the shell on purpose: a token the app
      // collects is a token the app has held, and a destination the app can
      // choose is not a boundary. Driven through real clicks, because a
      // panel that only works when called from the console is not a panel.
      await page.evaluate(() => { window.FoafOS.unaimOp('edot'); window.FoafOS.secrets.forget('edot', 'git.token'); });
      const panel = await page.evaluate(() => {
        const win = window.FoafOS.launchApp('publishing');
        return { opened: !!win, id: win?.id };
      });
      panel.opened && panel.id === 'foafos-publishing'
        ? pass('Publishing opens from the app registry like any other panel')
        : fail(`the Publishing panel did not open: ${JSON.stringify(panel)}`);

      const before = await page.textContent('#foafos-publishing');
      /not aimed anywhere/.test(before || '')
        ? pass('it says the verb is unaimed rather than showing an empty form')
        : fail(`Publishing did not report the unaimed state: ${(before || '').slice(0, 160)}`);

      await page.fill('#pub-edot-repo', 'danbri/e2e-notes');
      await page.fill('#pub-edot-prefix', 'edot/');
      await page.click('#foafos-publishing button:text("AIM")');
      await page.fill('#pub-edot-token', 'ghp_TYPED_INTO_THE_SHELL');
      await page.click('#foafos-publishing button:text("HOLD KEY")');
      await page.waitForTimeout(200);

      const after = await page.evaluate(() => ({
        text: document.getElementById('foafos-publishing').textContent,
        // the field must not still be holding it
        field: document.getElementById('pub-edot-token')?.value,
        aimed: window.FoafOS.ops.scopeFor('edot', 'git:write'),
        held: window.FoafOS.secrets.names('edot'),
      }));
      after.aimed?.repo === 'danbri/e2e-notes' && after.held?.includes('git.token')
        && /ready — danbri\/e2e-notes/.test(after.text)
        ? pass('a person can aim a verb and hand over a key without an app touching either')
        : fail(`the panel did not take: ${JSON.stringify({ ...after, text: after.text.slice(0, 140) })}`);
      after.field === ''
        ? pass('the token field is cleared, so the value is not left sitting in the DOM')
        : fail(`the token is still in the input: ${after.field}`);

      const shellTyped = await app2.evaluate(async () => ({
        // the app never saw it go in, and still cannot get it out
        names: await window.foaf.secrets.names(),
        get: (() => { try { window.foaf.secrets.get('git.token'); return 'returned'; } catch (e) { return e.name; } })(),
        commit: await window.foaf.invoke('git.commit', { path: 'edot/panel.md', content: 'via the panel' }),
      }));
      shellTyped.commit?.ok === true && shellTyped.get === 'FoafSecretsNotReadable'
        ? pass('and the app can then commit with a credential it never handled at all')
        : fail(`the panel-configured verb did not work: ${JSON.stringify(shellTyped)}`);
      !JSON.stringify(shellTyped).includes('ghp_TYPED_INTO_THE_SHELL')
        ? pass('the typed key is nowhere in what the app can observe')
        : fail('the key reached the app');

      // Sealing was implemented and nothing called it, so in practice secrets
      // were memory-only. The passphrase field in the drawer had been sealing
      // only the SESSION. Tested through a real reload, because "the code
      // calls seal()" and "the token is there afterwards" are different
      // claims and only the second one matters.
      const sealed = await page.evaluate(async () => {
        const r = await window.FoafOS.secrets.seal('hunter2');
        return { ...r, onDisk: !!localStorage.getItem('foafos.secrets'),
                 plaintext: (localStorage.getItem('foafos.secrets') || '').includes('ghp_TYPED_INTO_THE_SHELL') };
      });
      sealed.ok && sealed.onDisk && !sealed.plaintext
        ? pass('sealing writes CIPHERTEXT to the device, not the token')
        : fail(`sealing went wrong: ${JSON.stringify(sealed)}`);

      await page.reload();
      await page.waitForTimeout(2500);
      const afterReload = await page.evaluate(() => ({
        held: window.FoafOS.secrets.count(),
        hasSealed: window.FoafOS.secrets.hasSealed(),
        names: window.FoafOS.secrets.names('edot'),
      }));
      afterReload.held === 0 && afterReload.hasSealed === true
        ? pass('after a reload nothing is held, but the shell knows a sealed key exists')
        : fail(`the sealed state was misreported: ${JSON.stringify(afterReload)}`);

      const unsealed = await page.evaluate(async () => {
        const S = window.FoafOS.secrets;
        const r = await S.unseal('hunter2');
        const wrong = await S.unseal('not-it');
        return {
          r, wrong: wrong.reason, count: S.count(),
          // NOT a bug: grants are made when an app LAUNCHES, and nothing has
          // launched in this freshly reloaded page. So the value is back but
          // the app is still not entitled to name it, which is attenuation
          // outliving a reload rather than surviving it by accident.
          beforeLaunch: S.names('edot'),
        };
      });
      unsealed.r?.ok === true && unsealed.count === 2 && unsealed.wrong === 'wrong-passphrase'
        ? pass('the passphrase brings both keys back, and the wrong one is refused by name')
        : fail(`unsealing failed: ${JSON.stringify(unsealed)}`);
      unsealed.beforeLaunch === null
        ? pass('a restored secret is still gated on a grant — unsealing does not entitle anyone')
        : fail(`an unlaunched app could name its secrets: ${JSON.stringify(unsealed.beforeLaunch)}`);

      // Now the path a person actually takes: unlock, open the app, use it.
      await page.evaluate(() => window.FoafOS.launchApp('edot'));
      await page.waitForTimeout(4000);
      const app3 = page.frames().find(f => /edot\.html/.test(f.url()));
      if (!app3) {
        fail('edot frame never appeared after the reload');
      } else {
        const revived = await page.evaluate(() => ({
          names: window.FoafOS.secrets.names('edot'),
          aimed: window.FoafOS.ops.scopeFor('edot', 'git:write'),
        }));
        const commit = await app3.evaluate(() =>
          window.foaf.invoke('git.commit', { path: 'edot/after-reload.md', content: 'still works' }));
        revived.names?.includes('git.token') && revived.aimed?.repo === 'danbri/e2e-notes'
          && commit?.ok === true
          ? pass('a sealed key and its destination both survive a reload — the app publishes again')
          : fail(`the round trip did not survive: ${JSON.stringify({ revived, commit })}`);
      }

      const forgotten = await page.evaluate(() => {
        const r = window.FoafOS.secrets.clearSealed();
        return { ...r, hasSealed: window.FoafOS.secrets.hasSealed(),
                 anywhere: Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes('ghp_TYPED_INTO_THE_SHELL')) };
      });
      forgotten.forgotten === 2 && !forgotten.hasSealed && !forgotten.anywhere
        ? pass('FORGET means forget: the blob and everything held go, and nothing is left on disk')
        : fail(`clearing left something behind: ${JSON.stringify(forgotten)}`);
    }
    await page.unroute('https://api.github.com/**');
  }

  const stillAmbient = await page.evaluate(async () => {
    const m = await import('./foafos-apps.js');
    return m.ambientApps().map(a => a.id);
  });
  const migrated = ['calendar', 'files', 'edot', 'sheets'];
  migrated.every(id => !stillAmbient.includes(id))
    ? pass(`ambient-authority holders down to ${stillAmbient.length}: ${stillAmbient.join(', ')}`)
    : fail(`a migrated app still declares same-origin: ${stillAmbient.join(', ')}`);

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
