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
import { openStory, goto } from './lib/story.mjs';

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

  // ── 1. the default root boots a story, and boots it IN THE BOX ─────
  // This leg used to read `FinkInkEngine.compiledCount >= 1` — the host
  // page's ink engine — as the proof that a story installation boots a
  // story. That made "level 0 runs ink" the definition of working. Under the
  // layer model the shell must NOT compile ink: the story surface is the
  // boxed runner (level 1). The host engine is now deleted, so the
  // assertion is: a story surface opens, and the shell page has no ink
  // engine or compiler at all (a count read off a missing global would be 0
  // whatever happened, which proves nothing).
  {
    const { page, errs } = await open('');
    const st = await page.evaluate(() => ({
      root: FoafOS.root.id,
      hostEngine: ['FinkInkEngine', 'FinkPlayer', 'FinkUI', 'inkjs'].filter(m => m in window),
      boxed: [...document.querySelectorAll('iframe')].some(f => /apps\/storyrunner\//.test(f.src)),
      rootCaps: FoafOS.rootNode.capabilities.length,
    }));
    st.root === 'glitchcanary' && st.boxed
      ? pass(`default root boots its story in the box (${st.root}, ${st.rootCaps} root capabilities)`)
      : fail(`default root did not open the boxed story surface: ${JSON.stringify(st)}`);
    st.hostEngine.length === 0
      ? pass('level 0 has no ink engine or compiler — the shell is not a story player')
      : fail(`the host page still carries a story engine: ${st.hostEngine.join(', ')}`);
    errs.length === 0 ? pass('default root: no page errors') : fail(`default root errors: ${errs[0]}`);
    await page.close();
  }

  // ── 2. an office installation, with FINK simply unknown ────────────
  {
    const { page, errs } = await open('?root=office');
    const st = await page.evaluate(() => ({
      root: FoafOS.root.id,
      compiled: ['FinkInkEngine', 'inkjs'].filter(m => m in window).length
        + [...document.querySelectorAll('iframe')].filter(f => /apps\/storyrunner\//.test(f.src)).length,
      windows: document.querySelectorAll('.foafos-window').length,
      tree: FoafOS.apps.report(),
    }));
    st.root === 'office' && st.compiled === 0
      ? pass('office root boots with NO story engine and no story runner — the shell is not a story player')
      : fail(`office root still ran the story engine: ${JSON.stringify({ root: st.root, compiled: st.compiled })}`);
    st.windows >= 1 && st.tree.total >= 2
      ? pass(`office root opened its app instead (${st.windows} window, ${st.tree.total} nodes in the tree)`)
      : fail(`office root opened nothing: ${JSON.stringify({ windows: st.windows, total: st.tree.total })}`);

    // the picker shows only what this installation offers
    const picker = await page.evaluate(() => {
      FoafOS.openHome();
      const ids = [...document.querySelectorAll('#foafos-home .foafos-app')].map(b => b.dataset.app);
      document.getElementById('foafos-home')?.remove();
      return ids;
    });
    picker.length > 0 && !picker.includes('robbin') && picker.includes('edot')
      ? pass(`the picker lists only the installation's apps (${picker.join(', ')})`)
      : fail(`picker leaked apps outside the root: ${JSON.stringify(picker)}`);

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

  // A story playing in the runner, and a game THE STORY launched. The story
  // is a `story-session` node under the runner's window node (there is no
  // host "Story" node any more: the host engine is gone), and a game its
  // `# MINIGAME:` asks for is spawned beneath that session. The TOC's
  // GridLuck knot is the launch: `+ [Play GridLuck] # MINIGAME: gridluck`.
  const storyWithGame = async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 820 }, hasTouch: true });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 140)));
    const r = await openStory(page, `http://127.0.0.1:${PORT}`, repoName, 'inklet/toc.fink.js');
    await page.waitForFunction(() => [...FoafOS.apps.nodes.values()].some(n => n.appId === 'story-session'),
      null, { timeout: 15000 }).catch(() => {});
    const sessionBefore = await page.evaluate(() => {
      const t = FoafOS.apps;
      const s = [...t.nodes.values()].find(n => n.appId === 'story-session');
      const runner = s ? t.get(s.parentId) : null;
      return s ? { id: s.id, label: s.label, depth: t.depth(s.id), parent: runner?.appId,
                   runnerParent: runner ? t.get(runner.parentId)?.id === FoafOS.rootNode.id : false } : null;
    });
    await goto(r, 'gridluck_selected');
    await r.waitForFunction(() => window.__storyrunner.state.choices.some(c => /Play GridLuck/.test(c)),
      null, { timeout: 15000 });
    await r.evaluate(() => window.__storyrunner.choose(
      window.__storyrunner.state.choices.findIndex(c => /Play GridLuck/.test(c))));
    await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    return { page, errs, r, sessionBefore };
  };
  const sessionNode = () => {
    const s = [...FoafOS.apps.nodes.values()].find(n => n.appId === 'story-session');
    return s ? s.id : null;
  };

  // ── 5. the tree has BRANCHES: a game opened by a story is its child ─
  // A tree whose every node hangs off root is a list in tree clothing,
  // and the grouping it exists for has nothing to group.
  {
    const { page, errs, r, sessionBefore } = await storyWithGame();
    sessionBefore && sessionBefore.parent === 'storyrunner' && sessionBefore.runnerParent && sessionBefore.depth === 2
      ? pass(`the loaded story is a session node under the runner, under root ("${sessionBefore.label}" at depth 2)`)
      : fail(`no story-session under the runner: ${JSON.stringify(sessionBefore)}`);
    (await r.evaluate(() => window.__storyrunner.paused()))
      ? pass('the story paused on its # MINIGAME: beat')
      : fail('the story did not pause for the game it launched');

    const shape = await page.evaluate((sid) => {
      const t = FoafOS.apps;
      const kids = t.children(sid);
      return {
        storyId: sid,
        childLabels: kids.map(k => k.label),
        depths: kids.map(k => t.depth(k.id)),
        total: t.report().total,
      };
    }, await page.evaluate(sessionNode));
    shape.childLabels.length === 1 && shape.childLabels[0] === 'GridLuck' && shape.depths[0] === 3
      ? pass(`the game is a CHILD of the story, not a sibling (${shape.childLabels[0]} at depth 3 of ${shape.total} nodes)`)
      : fail(`tree is still flat: ${JSON.stringify(shape)}`);

    // and closing the story takes the game with it, for real
    const after = await page.evaluate(async (sid) => {
      const t = FoafOS.apps;
      const closed = t.close(sid);
      await new Promise(r => setTimeout(r, 1200));
      return {
        closed: closed.length,
        wmActive: window.FinkWM?.active,
        guestGone: !document.querySelector('#minigame-iframe-gridluck'),
        remaining: t.report().total,
      };
    }, await page.evaluate(sessionNode));
    after.closed === 2 && after.wmActive === false && after.guestGone
      ? pass('closing the story really tore down the game beneath it (guest frame gone, WM inactive)')
      : fail(`cascade did not reach the guest: ${JSON.stringify(after)}`);
    errs.length === 0 ? pass('story tree: no page errors') : fail(`story tree errors: ${errs[0]}`);
    await page.close();
  }

  // ── 6. the switcher IS the tree, and its verbs act on subtrees ─────
  {
    const { page, errs } = await storyWithGame();
    const sid = await page.evaluate(sessionNode);
    const labels = await page.evaluate(async (id) => {
      const { appById } = await import('./foafos-apps.js');
      return { runner: appById('storyrunner')?.name, session: FoafOS.apps.get(id)?.label };
    }, sid);

    const rows = await page.evaluate(() => {
      FoafOS.openSwitcher();
      return [...document.querySelectorAll('.foafos-switch-row')].map(r => ({
        depth: r.style.getPropertyValue('--depth'),
        title: r.querySelector('.ttl')?.textContent,
        acts: [...r.querySelectorAll('.foafos-switch-act')].map(b => b.getAttribute('aria-label')),
      }));
    });
    const runner = rows.find(r => r.title === labels.runner);
    const story = rows.find(r => r.title === labels.session);
    const game = rows.find(r => r.title === 'GridLuck');
    // The root row is SHOWN at depth 0; app subtrees start at depth 1.
    const rootRow = rows.find(r => r.depth === '0');
    rootRow && runner?.depth === '1' && story?.depth === '2' && game?.depth === '3'
      ? pass(`switcher shows lineage: root "${rootRow.title}" at 0, ${labels.runner} at 1, story "${labels.session}" at 2, GridLuck beneath it`)
      : fail(`switcher lineage wrong: ${JSON.stringify(rows)}`);
    rootRow && rootRow.acts.length === 1
      ? pass('the root row offers ⓘ only — no pause/close on the shell itself')
      : fail(`root row actions wrong: ${JSON.stringify(rootRow?.acts)}`);
    // the destructive verb must SAY what it takes with it
    /and 1 beneath it/.test((story?.acts || []).join(' '))
      ? pass('close/suspend name the subtree they take ("and 1 beneath it")')
      : fail(`subtree verbs do not disclose scope: ${JSON.stringify(story?.acts)}`);

    // suspending the story suspends the game under it, for real
    const susp = await page.evaluate(async (id) => {
      const t = FoafOS.apps;
      const story = t.get(id);
      const kid = t.children(id)[0];
      FoafOS.setSubtreeSuspended(id, true);
      await new Promise(r => setTimeout(r, 400));
      return { story: t.get(id).suspended, kid: t.get(kid.id).suspended,
               runner: t.get(story.parentId).suspended,
               root: t.get(FoafOS.rootNode.id).suspended };
    }, sid);
    susp.story && susp.kid && !susp.runner && !susp.root
      ? pass('suspending a subtree reaches its children and stops at its parent')
      : fail(`subtree suspend wrong: ${JSON.stringify(susp)}`);
    errs.length === 0 ? pass('switcher: no page errors') : fail(`switcher errors: ${errs[0]}`);
    await page.close();
  }

  // ── 7. the logger shows what was REFUSED ───────────────────────────
  // A capability system whose refusals are invisible teaches people that
  // nothing was refused. This is the surface where they become visible.
  {
    const { page, errs } = await open('?root=webtv');
    const log = await page.evaluate(() => {
      FoafOS.openLogger();
      // provoke a refusal the webtv root must produce
      FoafOS.apps.spawn({ appId: 'x', parentId: FoafOS.rootNode.id, capabilities: ['same-origin'] });
      FoafOS.store.grant('nope', []);
      FoafOS.store.set('nope', 'k', 'v');
      const rows = [...document.querySelectorAll('.foafos-log-row')];
      return {
        open: !!document.getElementById('foafos-logger'),
        rows: rows.length,
        bad: rows.filter(r => r.classList.contains('bad')).length,
        topics: rows.map(r => r.querySelector('.lt').textContent),
        count: document.getElementById('foafos-log-count')?.textContent || '',
      };
    });
    log.open && log.rows > 0
      ? pass(`logger is live (${log.rows} events)`)
      : fail(`logger empty — the '*' catch-all is not matching: ${JSON.stringify(log)}`);
    log.bad > 0 && log.topics.includes('app.spawn.refused') && log.topics.includes('store.denied')
      ? pass(`refusals are visible and marked (${log.bad} flagged, incl. app.spawn.refused + store.denied)`)
      : fail(`refusals not surfaced: ${JSON.stringify({ bad: log.bad, topics: log.topics.slice(-8) })}`);
    /refused/.test(log.count)
      ? pass(`the count says so too: "${log.count}"`)
      : fail(`count does not mention refusals: "${log.count}"`);

    // and the filter narrows rather than decorating
    const filtered = await page.evaluate(() => {
      const f = document.getElementById('foafos-log-filter');
      f.value = 'refused'; f.dispatchEvent(new Event('input', { bubbles: true }));
      return [...document.querySelectorAll('.foafos-log-row')].map(r => r.querySelector('.lt').textContent);
    });
    filtered.length > 0 && filtered.every(t => /refused/.test(t))
      ? pass(`filter narrows to ${filtered.length} matching rows`)
      : fail(`filter did not narrow: ${JSON.stringify(filtered.slice(0, 6))}`);
    errs.length === 0 ? pass('logger: no page errors') : fail(`logger errors: ${errs[0]}`);
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
