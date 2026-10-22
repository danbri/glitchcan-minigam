// One MiniApp instance (org.glitchcan.suite) running the FINK story runner, a FINK minigame
// opened from a story, a minigame page, edot Documents, Sheets and Files, and a package
// page; and the runner's usability and accessibility, checked as it does so.
//
//   cd magpie/miniapps && npm install && node test/ux.mjs
// Exit 0 when every check passes. Screenshots go to $SHOTS (default: test/shots, ignored by git).
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';

const SHOTS = process.env.SHOTS || new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
// RUNNER=https://danbri.github.io/glitchcan-minigam/magpie/miniapps/index.html runs it against the live site.
const srv = process.env.RUNNER ? { close: async () => {} } : await serve(0);
const RUNNER = process.env.RUNNER || `${srv.url}/magpie/miniapps/index.html`;

let failed = 0;
const findings = [];
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 15000, step = 100) {
  const t0 = Date.now();
  for (;;) { try { const v = await fn(); if (v) return v; } catch { /* not yet */ } if (Date.now() - t0 > ms) return null; await sleep(step); }
}

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await ctx.newPage();
const runnerErrors = [];
page.on('pageerror', (e) => runnerErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && m.location()?.url?.includes('/magpie/miniapps/')) runnerErrors.push(m.text()); });

const host = (fn, arg) => page.evaluate(fn, arg);
const states = () => host(() => window.__miniapps.host.log.map(e => `${e.scope}:${e.state}:${e.route || ''}`));
const stack = () => host(() => window.__miniapps.host.pages.map(p => ({ route: p.route, kind: p.kind, title: p.title, state: p.life.state })));
async function topFrame() {
  const h = await page.locator('#stage iframe.miniapp-page:not([hidden])').last().elementHandle();
  return h.contentFrame();
}
async function axe(frame, label, { assert = true, context = 'document' } = {}) {
  await frame.evaluate(AXE);
  const r = await frame.evaluate(async ({ tags, context }) => {
    const res = await window.axe.run(context === 'document' ? document : document.querySelector(context), { runOnly: { type: 'tag', values: tags } });
    return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, target: v.nodes[0]?.target?.join(' ') }));
  }, { tags: AXE_TAGS, context });
  if (assert) check(r.length === 0, `axe (WCAG 2.2 AA + best practice) on ${label}: ${r.length ? r.map(v => `${v.impact} ${v.id}×${v.n} at ${v.target}`).join('; ') : 'no violations'}`);
  else findings.push({ label, violations: r });
  return r;
}
async function smallTargets(frame, selector) {
  return frame.evaluate((sel) => [...document.querySelectorAll(sel)].filter(e => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return r.width > 0 && cs.visibility !== 'hidden' && (r.width < 44 || r.height < 44);
  }).map(e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`), selector);
}
const announced = () => host(() => document.getElementById('announce').textContent);
const storyFrame = () => page.frames().find(f => /storyrunner\/index\.html/.test(f.url()));

// ---------- 1. first launch: the permission sheet ----------
await page.goto(RUNNER);
await page.waitForSelector('#perm-dialog[open]', { timeout: 15000 });
const sheet = await host(() => ({
  modal: document.getElementById('perm-dialog').matches(':modal'),
  focusInside: document.getElementById('perm-dialog').contains(document.activeElement),
  items: [...document.querySelectorAll('#perm-list li')].map(li => li.textContent.trim()),
}));
check(sheet.modal && sheet.focusInside, 'permission sheet is a modal dialog and holds the focus');
check(sheet.items.length === 8 && sheet.items.every(s => s.length > 20), `it lists 8 requests, each with the app's own reason (first: "${sheet.items[0]}")`);
await axe(page.mainFrame(), 'the runner with the permission sheet open');
await page.screenshot({ path: SHOTS + '01-permissions.png' });
await page.click('#perm-allow');

check(!!await until(async () => (await stack())[0]?.state === 'shown'), 'the launcher page is shown');
const home = await topFrame();
check(!!await until(async () => await announced() === 'Glitchcan is open', 3000), `announced: "${await announced()}"`);
check(await host(() => document.activeElement?.tagName !== 'IFRAME'), 'the first page does not take the focus');
check(await page.title() === 'Glitchcan', `document title: "${await page.title()}"`);
await axe(page.mainFrame(), 'the runner chrome with the launcher open');
await axe(home, 'the launcher page (a package page)');
const smallChrome = await smallTargets(page.mainFrame(), 'header button, #menu-btn, .skip');
check(smallChrome.length === 0, `chrome touch targets are at least 44×44 px${smallChrome.length ? ': ' + smallChrome.join(', ') : ''}`);
const smallHome = await smallTargets(home, 'a, button');
check(smallHome.length === 0, `launcher touch targets are at least 44×44 px${smallHome.length ? ': ' + smallHome.join(', ') : ''}`);
await page.screenshot({ path: SHOTS + '02-launcher.png' });

// The skip link is the first stop and lands inside the app page.
check(await host(() => document.activeElement.id) === 'skip', 'after the permission sheet the focus is back at the top, on the skip link');
await page.keyboard.press('Enter');
check(await host(() => document.activeElement?.tagName === 'IFRAME' && !document.activeElement.hidden), 'the skip link puts the focus inside the app page');

// ---------- 2. a FINK story, as a page ----------
await home.click('a[href*="toc.fink.js"]');
check(!!await until(async () => storyFrame() && storyFrame().evaluate(() => window.__storyrunner.ready() && window.__storyrunner.state.choices.length > 0), 20000),
  'the FINK story runner plays the table of contents inside the MiniApp');
const s1 = await stack();
check(s1.length === 2 && s1[1].kind === 'app' && s1[1].title === 'Table of contents', `page stack: ${s1.map(p => p.title).join(' › ')}`);
check(await page.title() === 'Table of contents · Glitchcan', `document title: "${await page.title()}"`);
check(!!await until(async () => await announced() === 'Table of contents opened', 3000), `announced: "${await announced()}"`);
check(await host(() => document.activeElement?.tagName === 'IFRAME' && /storyrunner/.test(document.activeElement.src)), 'the focus moved into the story');
const crumbs = await host(() => ({ text: document.getElementById('crumbs').textContent, back: document.getElementById('back').getAttribute('aria-label'),
  current: document.querySelector('#crumbs [aria-current="page"]')?.textContent }));
check(crumbs.back === 'Back to Glitchcan' && crumbs.current === 'Table of contents', `Back is "${crumbs.back}"; breadcrumbs "${crumbs.text}"`);
check(await host(() => history.state?.depth === 1), 'the page is a browser history entry');
const deep = new URL(page.url()).searchParams.get('uri');
check(/pages\/story\/story\?/.test(deep) && new URLSearchParams(deep.split('?')[1]).get('story') === '/glitchcan-minigam/inklet/toc.fink.js', `the address bar is a deep link to this story: ${deep}`);
await axe(storyFrame(), 'the FINK story runner (an existing foafos app)', { assert: false });
await page.screenshot({ path: SHOTS + '03-story.png' });

// ---------- 3. # MINIGAME: from the story opens a game page; finishing it resumes the story ----------
await storyFrame().evaluate(() => window.__storyrunner.goto('gridluck_selected'));
await until(() => storyFrame().evaluate(() => window.__storyrunner.state.choices.length > 0));
await storyFrame().evaluate(() => window.__storyrunner.choose(0));
check(!!await until(async () => (await stack()).at(-1)?.kind === 'game'), '# MINIGAME: gridluck opens a game page on top of the story');
check(await storyFrame().evaluate(() => window.__storyrunner.paused()), 'the story waits for the game');
const g = await stack();
check(g.at(-1).route === 'game:gridluck' && await host(() => history.state?.depth === 2), `game page "${g.at(-1).title}" is history entry 2`);
await until(async () => (await stack()).at(-1).state === 'shown');
await page.screenshot({ path: SHOTS + '04-minigame.png' });
const gameFrame = await topFrame();
await gameFrame.evaluate(() => parent.postMessage({ type: 'complete', result: { success: true, score: 42, variables: {} } }, '*'));
check(!!await until(async () => (await stack()).length === 2 && !(await storyFrame().evaluate(() => window.__storyrunner.paused()))), 'finishing the game closes its page and the story resumes');
check(!!await until(() => storyFrame().evaluate(() => window.__storyrunner.state.prose.some(p => /You return from the game/.test(p.text)))), 'the story continues after the game ("You return from the game.")');
check(await host(() => history.state?.depth === 1), 'history went back with it (depth 1)');
check(!!await until(async () => /Back at Table of contents|completed/.test(await announced()), 3000), `announced: "${await announced()}"`);

// ---------- 4. browser Back is the app's Back ----------
await page.goBack();
check(!!await until(async () => (await stack()).length === 1 && (await stack())[0].state === 'shown'), 'browser Back returns to the launcher');
check(await host(() => window.__miniapps.tree.children(window.__miniapps.host.node.id).length === 0), "the story's capability node was closed with its page");
check(!!await until(async () => await announced() === 'Back at Glitchcan', 3000), `announced: "${await announced()}"`);

// ---------- 5. edot Documents, Sheets and Files, with brokered storage ----------
const office = async (href, urlRe, title, probe) => {
  await (await topFrame()).click(`a[href*="${href}"]`);
  const f = await until(() => page.frames().find(fr => urlRe.test(fr.url())), 15000);
  const ok = f && await until(() => f.evaluate(probe), 25000, 250);
  check(!!ok, `${title} runs as a page of the MiniApp (${typeof ok === 'string' ? ok : JSON.stringify(ok)})`);
  check((await stack()).at(-1).title === title, `its title is "${title}"`);
  return f;
};
await office('editor.html', /edot\/edot\.html/, 'Documents', () => {
  try { parent.document; return false; } catch { /* opaque origin */ }
  return !!document.querySelector('edot-editor, .edot-app, main') && 'UI up, opaque origin';
});
check(!!await until(() => host(() => Object.keys(window.__miniapps.store.snapshot('edot') || {}).includes('edot.library.v1')), 10000), 'edot saved its document library through the runner (FoafStore "edot")');
await page.screenshot({ path: SHOTS + '05-documents.png' });
await page.goBack();
await until(async () => (await stack()).length === 1);

await office('sheets.html', /edot\/data\/data\.html/, 'Sheets', () => document.querySelector('edot-data')?.engine?.storageKind === 'broker' && 'storage: broker');
await page.goBack();
await until(async () => (await stack()).length === 1);

const files = await office('files.html', /edot\/files\/files\.html/, 'Files', () => document.querySelector('edot-files')?.mount?.brokered === true && 'brokered mount');
await files.evaluate(() => document.querySelector('edot-files').mount.write('/notes/miniapp.txt', new TextEncoder().encode('written from a MiniApp page')));
check(!!await until(() => host(() => Object.keys(window.__miniapps.store.snapshot('files') || {}).length > 0)), 'a file written in Files reached the runner\'s store');
await axe(files, 'edot Files (an existing foafos app)', { assert: false });
await page.goBack();
await until(async () => (await stack()).length === 1);

// ---------- 6. a minigame as a page of its own ----------
await (await topFrame()).click('a[href*="gems.html"]');
check(!!await until(async () => (await stack()).at(-1)?.route === 'pages/game/gems' && (await stack()).at(-1).state === 'shown'), 'Gem Collector opens as a game page');
await page.click('#hide', { force: true }).catch(() => {});
await host(() => window.__miniapps.host.setVisible(false));
check((await states()).slice(-2).join(' ') === 'page:hidden:pages/game/gems global:hidden:', 'leaving the app pauses the game page, then the app');
await host(() => window.__miniapps.host.setVisible(true));
check((await states()).slice(-2).join(' ') === 'global:shown: page:shown:pages/game/gems', 'returning resumes them');
await (await topFrame()).evaluate(() => parent.postMessage({ type: 'complete', result: { success: true, score: 15, variables: {} } }, '*'));
check(!!await until(async () => /Gem Collector: completed, score 15/.test(await announced()), 3000), `the result is announced: "${await announced()}"`);
await host(() => document.activeElement?.blur());   // keys typed inside a frame go to that frame, not to the runner
await page.keyboard.press('Alt+ArrowLeft');
check(!!await until(async () => (await stack()).length === 1), 'Alt+Left goes back');

// ---------- 7. preferences reach every kind of page ----------
await page.click('#menu-btn');
check(await host(() => document.getElementById('menu').matches(':modal')), 'the app menu is a modal dialog');
await axe(page.mainFrame(), 'the runner with the app menu open');
await page.check('#opt-scale input[value="2"]');
await page.check('#opt-theme input[value="contrast"]');
await page.check('#opt-motion input[value="reduce"]');
await page.screenshot({ path: SHOTS + '06-menu.png' });
await page.click('#menu-done');
check(await host(() => document.activeElement.id === 'menu-btn'), 'closing the menu returns the focus to the menu button');
const launcher = await topFrame();
const applied = await launcher.evaluate(() => ({ font: getComputedStyle(document.documentElement).fontSize, theme: document.documentElement.dataset.runnerTheme,
  bg: getComputedStyle(document.body).backgroundColor }));
check(applied.font === '32px' && applied.theme === 'contrast' && applied.bg === 'rgb(0, 0, 0)', `package page: text 200%, high contrast (${JSON.stringify(applied)})`);
await axe(launcher, 'the launcher at 200% text in high contrast');
await page.screenshot({ path: SHOTS + '07-contrast-200.png' });
await launcher.click('a[href*="hello.html"]');
await until(async () => (await stack()).at(-1)?.state === 'shown');
const hello = await topFrame();
const motion = await hello.evaluate(() => getComputedStyle(document.querySelector('.spin')).animationDuration);
check(motion === '0.001s', `package page: reduced movement stops the spinner (animation-duration ${motion})`);
await hello.click('#err');
check(!!await until(() => host(() => !document.getElementById('problem').hidden)), 'an error in the logic layer shows a notice');
const prob = await host(() => ({ role: document.getElementById('problem').getAttribute('role'), text: document.getElementById('problem-text').textContent,
  actions: [...document.querySelectorAll('#problem-actions button')].map(b => b.textContent) }));
check(prob.role === 'alert' && prob.actions.includes('Reload this page'), `it is an alert in plain words, with a way on: "${prob.text}" [${prob.actions.join(', ')}]`);
await page.click('#problem-actions button:has-text("Done")');
await page.goBack();
await until(async () => (await stack()).length === 1);
await (await topFrame()).click('a[href*="toc.fink.js"]');
await until(() => storyFrame() && storyFrame().evaluate(() => window.__storyrunner.ready()), 20000);
check(await page.locator('#stage iframe.miniapp-page:not([hidden])').last().evaluate(f => f.style.zoom) === '2', 'story runner: the text size reaches it as zoom 2 on its frame');
check(await storyFrame().evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sk-choice-ink').trim()) === '#ff0', 'story runner: high contrast reaches it as skin tokens (choice ink #ff0)');
check(!(await storyFrame().evaluate(() => /cannot watch/.test(document.body.innerText))), 'story runner: no "cannot watch" message (story.observe is answered)');
await page.screenshot({ path: SHOTS + '08-story-contrast-200.png' });
await page.goBack();
await until(async () => (await stack()).length === 1);
await (await topFrame()).click('a[href*="editor.html"]');
await until(async () => (await stack()).at(-1)?.title === 'Documents');
check(await page.locator('#stage iframe.miniapp-page:not([hidden])').last().evaluate(f => f.style.zoom) === '2', 'edot: the text size reaches it as zoom 2 on its frame');
await page.goBack();
await until(async () => (await stack()).length === 1);
await page.click('#menu-btn');
await page.check('#opt-scale input[value="1"]');
await page.check('#opt-theme input[value="system"]');
await page.check('#opt-motion input[value="system"]');
await page.click('#menu-done');

// ---------- 8. forced colours (Windows High Contrast) ----------
await page.emulateMedia({ forcedColors: 'active' });
await axe(page.mainFrame(), 'the runner chrome in forced-colours mode');
await page.screenshot({ path: SHOTS + '09-forced-colours.png' });
await page.emulateMedia({ forcedColors: 'none' });

// ---------- 9. remembered decisions, deep links, Chinese ----------
const p2 = await ctx.newPage();
await p2.goto(`${RUNNER}?lang=zh-CN&uri=${encodeURIComponent('foafos://miniapp/org.glitchcan.suite/pages/story/story?story=/glitchcan-minigam/inklet/hampstead.fink.js&title=Hampstead')}`);
check(!!await until(() => p2.evaluate(() => window.__miniapps?.host.pages[0]?.life.state === 'shown')), 'a deep link opens straight at the story (no permission sheet: the answer was remembered)');
check(!(await p2.evaluate(() => document.getElementById('perm-dialog').open)), 'the permission sheet did not ask again');
const hamp = () => p2.frames().find(f => /storyrunner\/index\.html/.test(f.url()));
check(!!await until(() => hamp() && hamp().evaluate(() => window.__storyrunner.ready() && /hampstead/.test(window.__storyrunner.state.storyUrl || '') && window.__storyrunner.state.prose.length > 0), 25000),
  'and Hampstead plays (prose on screen)');
const zh = await p2.evaluate(() => ({ lang: document.documentElement.lang, menu: document.getElementById('menu-btn').getAttribute('aria-label'),
  skip: document.getElementById('skip').textContent, title: document.getElementById('page-title').textContent }));
check(zh.lang === 'zh-CN' && zh.menu === '应用菜单' && zh.skip === '跳到应用' && zh.title === 'Hampstead', `chrome in Chinese: ${JSON.stringify(zh)}`);
await p2.screenshot({ path: SHOTS + '10-deeplink-zh.png' });
await p2.close();

// ---------- 10. slow pages, missing apps, failed downloads ----------
const p3 = await ctx.newPage();
await p3.route('**/magpie/edot/files/files.html', () => { /* never answer */ });
await p3.goto(`${RUNNER}?slowms=1500&uri=${encodeURIComponent('foafos://miniapp/org.glitchcan.suite/pages/office/files')}`);
check(!!await until(() => p3.evaluate(() => !document.getElementById('problem').hidden), 8000), 'a page that does not load is reported, not left blank');
const slow = await p3.evaluate(() => ({ text: document.getElementById('problem-text').textContent, actions: [...document.querySelectorAll('#problem-actions button')].map(b => b.textContent) }));
check(/taking a long time/.test(slow.text) && slow.actions.includes('Reload this page'), `"${slow.text}" [${slow.actions.join(', ')}]`);
await p3.goto(`${RUNNER}?app=org.example.nothing`);
check(!!await until(() => p3.evaluate(() => /There is no app called/.test(document.getElementById('problem-text').textContent))), 'an unknown app id gets a plain message');
await p3.route('**/dist/org.glitchcan.suite-*.ma', (r) => r.abort());
await p3.goto(RUNNER);
check(!!await until(() => p3.evaluate(() => /could not be downloaded/.test(document.getElementById('problem-text').textContent))), 'a failed download says what to do');
check(await p3.evaluate(() => [...document.querySelectorAll('#problem-actions button')].some(b => b.textContent === 'Try again')), 'and offers Try again');
await p3.close();

// ---------- 11. closing ----------
await page.click('#menu-btn');
await page.click('#menu-close-app');
check(!!await until(() => host(() => !document.getElementById('closed').hidden)), 'Close app ends the session');
check(await host(() => document.activeElement.id === 'reopen'), 'and the focus lands on "Open again"');
check(await host(() => window.__miniapps.tree.children(window.__miniapps.root.id).length === 0), 'every capability node under the runner is closed');

check(runnerErrors.length === 0, `no errors from the runner itself${runnerErrors.length ? ': ' + runnerErrors.join(' | ') : ''}`);
for (const f of findings) {
  console.log(`INFO axe on ${f.label}: ${f.violations.length ? f.violations.map(v => `${v.impact} ${v.id}×${v.n}`).join('; ') : 'no violations'}`);
}
await browser.close();
await srv.close();
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
