// Shell chrome as apps.
//
// The breadcrumb, the story status line and the FINK load meter were
// markup in index.html, and a storyless installation dealt with them by
// stylesheet: `display: none !important`. They still existed, still held
// ids the story engine wrote into, and still sat in the document and the
// accessibility tree — merely painted over.
//
// They are apps now, with `surface: 'chrome'`, offered per root manifest.
// What this suite holds:
//
// 1. On a story root they mount: element present, node in the app tree.
// 2. On the office root they are ABSENT — the element is not in the DOM
//    at all. This is the whole point, so it is asserted on
//    `getElementById`, not on computed style.
// 3. They toggle from the picker, and the breadcrumb survives the round
//    trip with its listeners intact (it caches its DOM at init and binds
//    once, so a naive destroy/rebuild would come back inert).
// 4. Attenuation covers them like everything else — and DID refuse them
//    at first, because `shell` was a capability no root held. Which also
//    means Maker and Logger could never be launched from the picker; the
//    drawer's own button called openLogger() directly and hid it. That
//    regression test is here too.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const repoName = basename(repoRoot);
const PORT = 8163;
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
const base = `http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`;
// DERIVED, not written here. This used to be the literal three ids that
// were converted in July 2026, so when a FOURTH piece of story furniture
// turned out to be hard-coded in index.html — the bottom-left radial ☰,
// offering NavPath, "Reload story" and a link out of the installation — the
// suite had nothing to say about it. It was reported from a phone instead.
// Deriving the list means registering a chrome app is enough to be checked.
const CHROME_IDS = (await import('../foafos-apps.js')).chromeApps().map(a => a.id);
const CHROME_MOUNTS = (await import('../foafos-apps.js')).chromeApps().map(a => a.mount);

// The backstop for the same class of miss: story-player furniture that was
// never registered as an app at all, so no manifest can decline it. Ids live
// HERE on purpose — adding narrative chrome to index.html without giving it
// a registry entry should fail this, loudly, rather than ship.
const STORY_FURNITURE = [
  'breadcrumb-container', 'breadcrumb-toggle', 'stats-bar',
  'scroll-status-bar', 'radial-menu', 'dev-panel',
];

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });

  const open = async (query) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 140)));
    await page.goto(base + query);
    await page.waitForFunction(() => !!window.FoafOS?.root, null, { timeout: 25000 });
    await page.waitForTimeout(2500);
    return { page, errs };
  };

  // ── 1. a story root wears its furniture, as apps ───────────────────
  {
    const { page, errs } = await open('');
    const st = await page.evaluate(([ids, mounts]) => ({
      offered: FoafOS.chrome.offered(),
      mounted: ids.filter(id => FoafOS.chrome.isMounted(id)),
      dom: Object.fromEntries(mounts.map(m => [m, !!document.getElementById(m)])),
      inTree: (function walk(n) {
        return FoafOS.apps.children(n.id).flatMap(c => [c.appId, ...walk(c)]);
      })(FoafOS.rootNode),
    }), [CHROME_IDS, CHROME_MOUNTS]);
    CHROME_IDS.every(id => st.mounted.includes(id))
      ? pass(`story root mounts all ${CHROME_IDS.length} chrome apps (${st.mounted.join(', ')})`)
      : fail(`chrome not mounted: ${JSON.stringify(st)}`);
    Object.values(st.dom).every(Boolean)
      ? pass('their elements are in the document')
      : fail(`elements missing: ${JSON.stringify(st.dom)}`);
    CHROME_IDS.every(id => st.inTree.includes(id))
      ? pass('and they are nodes in the app tree, not special cases')
      : fail(`not in the tree: ${JSON.stringify(st.inTree)}`);

    // ── 3. toggling, and the breadcrumb surviving it ────────────────
    const off = await page.evaluate(() => {
      FoafOS.launchApp('breadcrumb');
      return { mounted: FoafOS.chrome.isMounted('breadcrumb'),
               inDom: !!document.getElementById('breadcrumb-container') };
    });
    (!off.mounted && !off.inDom)
      ? pass('toggling a chrome app off removes the element, not just its paint')
      : fail(`breadcrumb did not go away: ${JSON.stringify(off)}`);

    const on = await page.evaluate(() => {
      FoafOS.launchApp('breadcrumb');
      const el = document.getElementById('breadcrumb-container');
      return { mounted: FoafOS.chrome.isMounted('breadcrumb'), inDom: !!el,
               // it caches its own DOM at init and binds its toggle once;
               // coming back inert would look identical on screen
               wired: window.FinkBreadcrumb?.elements?.container === el };
    });
    (on.mounted && on.inDom && on.wired)
      ? pass('and back on with its listeners intact')
      : fail(`breadcrumb came back broken: ${JSON.stringify(on)}`);

    // the picker states it, on screen and to a screen reader
    const picker = await page.evaluate(() => {
      const h = FoafOS.openHome();
      const t = [...h.querySelectorAll('.foafos-app.chrome-toggle')]
        .map(x => `${x.querySelector('.nm').textContent}=${x.getAttribute('aria-pressed')}`);
      h.remove();
      return t;
    });
    picker.length === CHROME_IDS.length && picker.every(t => t.endsWith('=true'))
      ? pass(`picker shows chrome as pressed toggles (${picker.join(', ')})`)
      : fail(`picker did not report chrome state: ${JSON.stringify(picker)}`);

    // the switcher counts furniture apart from work
    const tally = await page.evaluate(() => {
      const s = FoafOS.openSwitcher();
      const h = s.querySelector('h2')?.textContent || '';
      s.remove();
      return h;
    });
    new RegExp(`\\+ ${CHROME_IDS.length} chrome`).test(tally)
      ? pass(`switcher separates furniture from work ("${tally.trim()}")`)
      : fail(`switcher tally unhelpful: ${tally}`);

    errs.length === 0 ? pass('story root: no page errors') : fail(`errors: ${errs[0]}`);
    await page.close();
  }

  // ── 2. the office root does not have them at all ───────────────────
  {
    const { page, errs } = await open('?root=office');
    const st = await page.evaluate((furniture) => ({
      offered: FoafOS.chrome.offered(),
      dom: furniture.filter(id => document.getElementById(id)),
      // a refused launch, not a hidden one
      refused: (() => { const n = FoafOS.launchApp('breadcrumb'); return n === null; })(),
    }), STORY_FURNITURE);
    st.offered.length === 0 && st.dom.length === 0
      ? pass(`office root carries none of the ${STORY_FURNITURE.length} pieces of story furniture — absent, not hidden`)
      : fail(`office still carries chrome: ${JSON.stringify(st)}`);
    st.refused
      ? pass('and cannot be talked into mounting one')
      : fail('office mounted a chrome app it does not offer');

    // 4. the regression: shell-native apps launch from the picker
    const maker = await page.evaluate(() => {
      const before = document.querySelectorAll('.foafos-window').length;
      FoafOS.launchApp('maker');
      return document.querySelectorAll('.foafos-window').length - before;
    });
    maker > 0
      ? pass('Maker opens from the picker (it could not before: `shell` was held by no root)')
      : fail('Maker still refused — the picker tile is dead');

    errs.length === 0 ? pass('office root: no page errors') : fail(`errors: ${errs[0]}`);
    await page.close();
  }

  // ── 4b. same regression on the story root, for the Logger ──────────
  {
    const { page, errs } = await open('');
    const opened = await page.evaluate(() => {
      const before = document.querySelectorAll('.foafos-window').length;
      FoafOS.launchApp('logger');
      return document.querySelectorAll('.foafos-window').length - before;
    });
    opened > 0
      ? pass('Logger opens from the picker too')
      : fail('Logger refused from launchApp');
    errs.length === 0 ? pass('logger launch: no page errors') : fail(`errors: ${errs[0]}`);
    await page.close();
  }

  console.log(process.exitCode ? '\nCHROME E2E: FAIL' : '\nCHROME E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 250)}`);
  console.log('\nCHROME E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
