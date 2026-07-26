// Roots and the app tree.
//
// Two claims this holds:
//
// 1. An installation is a ROOT MANIFEST, not a story path. The shell used
//    to boot a story or nothing, which made "foafos as an office suite"
//    impossible without a fork. `?root=office` must come up with no story
//    engine involvement at all.
//
// 2. The tree ATTENUATES. An app can never be granted a capability its
//    parent does not hold, and root is everyone's ancestor — so trimming
//    a root manifest genuinely locks an installation down rather than
//    just hiding icons. The webtv root has no `same-origin`, so nothing
//    it opens can have it either, and that must be true in the running
//    page and not only in the data.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const repoName = basename(repoRoot);
const PORT = 8157;
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

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

  const open = async (query) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 140)));
    await page.goto(base + query);
    await page.waitForFunction(() => !!window.FoafOS?.root, null, { timeout: 20000 });
    await page.waitForTimeout(3000);
    return { page, errs };
  };

  // ── 1. the default root is unchanged: a story installation ─────────
  {
    const { page, errs } = await open('');
    const st = await page.evaluate(() => ({
      root: FoafOS.root.id,
      compiled: window.FinkInkEngine?.compiledCount || 0,
      rootCaps: FoafOS.rootNode.capabilities.length,
    }));
    st.root === 'glitchcanary' && st.compiled >= 1
      ? pass(`default root still boots a story (${st.root}, ${st.compiled} compiled, ${st.rootCaps} root capabilities)`)
      : fail(`default root regressed: ${JSON.stringify(st)}`);
    errs.length === 0 ? pass('default root: no page errors') : fail(`default root errors: ${errs[0]}`);
    await page.close();
  }

  // ── 2. an office installation, with FINK simply unknown ────────────
  {
    const { page, errs } = await open('?root=office');
    const st = await page.evaluate(() => ({
      root: FoafOS.root.id,
      compiled: window.FinkInkEngine?.compiledCount || 0,
      windows: document.querySelectorAll('.foafos-window').length,
      tree: FoafOS.apps.report(),
    }));
    st.root === 'office' && st.compiled === 0
      ? pass('office root boots with NO story compiled — the shell is not a story player')
      : fail(`office root still ran the story engine: ${JSON.stringify({ root: st.root, compiled: st.compiled })}`);
    st.windows >= 1 && st.tree.total >= 2
      ? pass(`office root opened its app instead (${st.windows} window, ${st.tree.total} nodes in the tree)`)
      : fail(`office root opened nothing: ${JSON.stringify({ windows: st.windows, total: st.tree.total })}`);

    // the installation refuses what it does not offer
    const refused = await page.evaluate(() => {
      const before = FoafOS.apps.report().total;
      FoafOS.launchApp('robbin');          // not in the office manifest
      return { before, after: FoafOS.apps.report().total };
    });
    refused.after === refused.before
      ? pass('an app outside the installation is refused, not quietly opened')
      : fail(`office root launched a game it does not offer (${refused.before} → ${refused.after})`);
    errs.length === 0 ? pass('office root: no page errors') : fail(`office root errors: ${errs[0]}`);
    await page.close();
  }

  // ── 3. attenuation is real in the running page, not just in data ───
  {
    const { page, errs } = await open('?root=webtv');
    const st = await page.evaluate(() => {
      const rootCaps = FoafOS.rootNode.capabilities;
      // robbamp declares same-origin; the webtv root does not hold it,
      // so the tree must refuse rather than hand it out.
      const attempt = FoafOS.apps.spawn({
        appId: 'robbamp', parentId: FoafOS.rootNode.id,
        capabilities: ['storage', 'audio', 'same-origin'],
      });
      return { root: FoafOS.root.id, rootCaps, refused: attempt.refused, excess: attempt.excess };
    });
    !st.rootCaps.includes('same-origin') && st.refused === true && (st.excess || []).includes('same-origin')
      ? pass('webtv root holds no same-origin, so nothing beneath it can be granted it')
      : fail(`attenuation did not bite: ${JSON.stringify(st)}`);
    errs.length === 0 ? pass('webtv root: no page errors') : fail(`webtv root errors: ${errs[0]}`);
    await page.close();
  }

  // ── 4. closing a parent takes its children with it ─────────────────
  {
    const { page } = await open('');
    const st = await page.evaluate(async () => {
      const t = FoafOS.apps;
      const parent = t.spawn({ appId: 'p', parentId: FoafOS.rootNode.id, capabilities: ['audio'] });
      const child = t.spawn({ appId: 'c', parentId: parent.id, capabilities: ['audio'] });
      const grand = t.spawn({ appId: 'g', parentId: child.id, capabilities: [] });
      const before = t.report().total;
      const closed = t.close(parent.id);
      return { before, closed: closed.length, after: t.report().total,
               childGone: t.get(child.id) === null, grandGone: t.get(grand.id) === null };
    });
    st.closed === 3 && st.childGone && st.grandGone && st.after === st.before - 3
      ? pass('closing a parent cascades to its whole subtree')
      : fail(`cascade close wrong: ${JSON.stringify(st)}`);

    // and an unknown root falls back rather than booting into nothing
    await page.close();
  }
  {
    const { page } = await open('?root=nonsense');
    const st = await page.evaluate(() => ({
      root: FoafOS.root.id,
      said: FoafOS.bus.retained('root.ready')[0]?.data?.fellBack,
    }));
    st.root === 'glitchcanary' && st.said === true
      ? pass('an unknown root falls back to the default, and says it fell back')
      : fail(`bad root handling: ${JSON.stringify(st)}`);
    await page.close();
  }

  console.log(process.exitCode ? '\nROOT E2E: FAIL' : '\nROOT E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 250)}`);
  console.log('\nROOT E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
