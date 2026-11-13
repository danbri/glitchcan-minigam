// The shell's everyday moves: finding apps, switching, snapping, recall keys and notices.
// Headless, against `foafos-stack start shell`. No window appears on the desktop.
//   CHROMIUM_PATH=... node e2e-shell-ux.mjs
import { chromium } from 'playwright';

const { CHROMIUM_PATH } = process.env;
const URL_ = process.env.SHELL_URL || 'http://localhost:8080/glitchcan-minigam/inklet/finkapp/?root=all&player=none';
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) failed++; };

const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
const open = async (viewport, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { if (!/serviceWorker/.test(e.message)) errors.push(e.message); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.FoafOS?.launchApp, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  return { ctx, page, errors };
};
const keys = async (page, list) => {
  await page.keyboard.down('Control');
  for (const k of list) await page.keyboard.press(k);
  await page.keyboard.up('Control');
  await page.waitForTimeout(250);
};
const onTop = (page, sel) => page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return !!document.elementFromPoint(r.left + r.width / 2, r.top + 8)?.closest(s);
}, sel);

try {
  const { ctx, page, errors } = await open({ width: 1280, height: 800 });

  // All apps
  await keys(page, [';', 'a']);
  check(await page.isVisible('#foafos-home'), 'ctrl ; a opens All apps');
  check(await page.evaluate(() => document.querySelector('#foafos-home details[data-folder="essentials"]')?.open === true), 'Essentials starts open');
  await page.fill('.foafos-home-search input', 'zzzz');
  check(await page.isVisible('.foafos-home-none'), 'a search with no match says so');
  await page.evaluate(() => localStorage.setItem('foafos.apps.recent', JSON.stringify(['chat'])));
  await page.keyboard.press('Escape');
  await keys(page, [';', 'a']);
  await page.fill('.foafos-home-search input', 'chat');
  check(await page.evaluate(() => [...document.querySelectorAll('.foafos-app[data-app="chat"]')].filter((b) => !b.hidden).length) === 1, 'an app in Recent is found once');
  const chatWords = await page.evaluate(() => document.querySelector('.foafos-app[data-app="chat"]').getAttribute('aria-label').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3));
  await page.fill('.foafos-home-search input', `${chatWords.at(-1)} ${chatWords[0]}`);
  check(await page.evaluate(() => [...document.querySelectorAll('.foafos-app[data-app="chat"]')].some((b) => !b.hidden)), `words match in any order (${chatWords.at(-1)} ${chatWords[0]})`);
  await page.fill('.foafos-home-search input', 'counter');
  check(await page.evaluate(() => [...document.querySelectorAll('.foafos-app[data-app="widget-tally"]')].some((b) => !b.hidden)), 'a widget is found by what it does');
  await page.fill('.foafos-home-search input', 'widget');
  check(await page.evaluate(() => [...document.querySelectorAll('.foafos-app[data-app^="widget-"]')].filter((b) => !b.hidden).length >= 3), 'searching a folder name ("widget") lists what is in it');
  await page.fill('.foafos-home-search input', 'counter');
  check(await page.evaluate(() => { const d = [...document.querySelectorAll('.foafos-app[data-app="widget-tally"]')].find((b) => !b.hidden)?.querySelector('.ds'); return !!d && d.offsetHeight > 0 && /counter/i.test(d.textContent); }), 'search results show what each one does');
  check(await page.evaluate(() => [...document.querySelectorAll('#foafos-home section:not([hidden]) .foafos-folder-count')].every((c) => Number(c.textContent) === [...c.closest('section').querySelectorAll('.foafos-app')].filter((b) => !b.hidden).length)), 'folder counts count the matches while searching');
  // Pinning: ☆ pins an app into a Pinned folder at the top; ★ takes it out again
  await page.fill('.foafos-home-search input', '');
  await page.evaluate(() => document.querySelector('.foafos-app[data-app="files"] + .foafos-app-pin').click());
  await page.waitForTimeout(200);
  const pinnedNow = await page.evaluate(() => { const f = document.querySelector('#foafos-home details[data-folder]'); return { first: f?.dataset.folder, apps: [...f.querySelectorAll('.foafos-app')].map((b) => b.dataset.app), focus: document.activeElement?.getAttribute('aria-label') }; });
  await page.evaluate(() => document.querySelector('#foafos-home details[data-folder="pinned"] .foafos-app[data-app="files"] + .foafos-app-pin').click());
  await page.waitForTimeout(200);
  const unpinned = await page.evaluate(() => !document.querySelector('#foafos-home details[data-folder="pinned"]'));
  check(pinnedNow.first === 'pinned' && pinnedNow.apps.join() === 'files' && /Unpin Files/.test(pinnedNow.focus || '') && unpinned,
    `☆ pins an app at the top of All apps, ★ unpins it (${JSON.stringify({ ...pinnedNow, unpinned })})`);
  // Pinned apps in your own order: Alt+Left moves one earlier; its sheet's "Move later" moves it back
  const order = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const pinBtn = (id) => document.querySelector(`#foafos-home .foafos-app-cell .foafos-app[data-app="${id}"] + .foafos-app-pin`);
    pinBtn('chat').click(); await wait(100);
    pinBtn('files').click(); await wait(100);
    const before = FoafOS.pinnedApps().join();
    const files = document.querySelector('#foafos-home details[data-folder="pinned"] .foafos-app[data-app="files"]');
    files.focus();
    files.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true }));
    await wait(100);
    const afterKey = FoafOS.pinnedApps().join();
    const focus = document.activeElement?.dataset?.app;
    const f2 = document.querySelector('#foafos-home details[data-folder="pinned"] .foafos-app[data-app="files"]');
    f2.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await wait(100);
    const acts = [...document.querySelectorAll('.foafos-app-sheet button:not([hidden])')].map((x) => x.textContent);
    document.querySelector('.foafos-app-sheet [data-act="later"]').click(); await wait(100);
    const afterSheet = FoafOS.pinnedApps().join();
    for (const id of ['chat', 'files']) pinBtn(id)?.click();
    await wait(100);
    return { before, afterKey, focus, acts, afterSheet, left: FoafOS.pinnedApps().join() };
  });
  check(order.before === 'chat,files' && order.afterKey === 'files,chat' && order.focus === 'files' && order.acts.includes('Move later') && !order.acts.includes('Move earlier')
    && order.afterSheet === 'chat,files' && order.left === '', `pinned apps can be put in your own order (${JSON.stringify(order)})`);

  // A widget can be pinned too, and opens from Pinned
  await page.evaluate(() => { const d = document.querySelector('#foafos-home details[data-folder="widgets"]'); d.open = true; d.querySelector('.foafos-app[data-app="widget-tally"] + .foafos-app-pin').click(); });
  await page.waitForTimeout(200);
  const wPinned = await page.evaluate(() => [...document.querySelectorAll('#foafos-home details[data-folder="pinned"] .foafos-app')].map((b) => b.dataset.app));
  const tallyBefore = await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].filter((w) => /Tally/.test(w.textContent)).length);
  await page.evaluate(() => document.querySelector('#foafos-home details[data-folder="pinned"] .foafos-app[data-app="widget-tally"]').click());
  await page.waitForTimeout(600);
  const tallyAfter = await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].filter((w) => /Tally/.test(w.textContent)).length);
  await page.evaluate(() => { localStorage.removeItem('foafos.apps.pinned'); [...document.querySelectorAll('.foafos-window')].filter((w) => /Tally/.test(w.textContent)).forEach((w) => w.querySelector('.foafos-window-close')?.click()); });
  await page.waitForTimeout(300);
  await keys(page, [';', 'a']);
  check(wPinned.join() === 'widget-tally' && tallyAfter === tallyBefore + 1, `a widget can be pinned and opens from Pinned (${wPinned}, ${tallyBefore} → ${tallyAfter})`);

  // Arrow keys: Down from search enters the grid, Right moves along, Up from the top row returns to search
  await page.fill('.foafos-home-search input', '');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => document.querySelector('#foafos-home details[data-folder="recent"]')?.open === true), 'clearing a search leaves the folders as they were');
  await page.focus('.foafos-home-search input');
  await page.keyboard.press('ArrowDown');
  const firstApp = await page.evaluate(() => document.activeElement?.classList.contains('foafos-app') && document.activeElement.dataset.app);
  await page.keyboard.press('ArrowRight');
  const secondApp = await page.evaluate(() => document.activeElement?.dataset?.app);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp');
  const backInSearch = await page.evaluate(() => document.activeElement?.matches('.foafos-home-search input'));
  check(!!firstApp && !!secondApp && secondApp !== firstApp && backInSearch, `arrow keys move through All apps (${firstApp} → ${secondApp}, back to search: ${backInSearch})`);
  // The best match is marked and is what Enter or Down goes to: a name, before a description
  // that mentions it ("activity" used to open Chat, whose description says "app activity")
  const topFor = async (q) => { await page.fill('.foafos-home-search input', q); return page.evaluate(() => ({ first: [...document.querySelectorAll('#foafos-home .foafos-app')].find((b) => !b.hidden)?.dataset.app, top: document.querySelector('#foafos-home .foafos-top-hit')?.dataset.app })); };
  const tActivity = await topFor('activity'), tDrift = await topFor('drift');
  await page.fill('.foafos-home-search input', 'activity');
  await page.keyboard.press('ArrowDown');
  const downTo = await page.evaluate(() => document.activeElement?.dataset?.app);
  await page.focus('.foafos-home-search input');
  check(tActivity.first === 'chat' && tActivity.top === 'activity' && /drift/.test(tDrift.top || '') && tDrift.first !== tDrift.top && downTo === 'activity',
    `search marks the best name match, and Down goes to it (${JSON.stringify(tActivity)}, ${JSON.stringify(tDrift)}, ${downTo})`);
  await page.fill('.foafos-home-search input', 'tally');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  check(await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].some((w) => /Tally/.test(w.textContent))), 'Enter opens the top result, and search finds widgets');

  // Right-click (or the menu key) on an app shows the same sheet; Escape puts it away, and a
  // plain click afterwards still opens apps
  await keys(page, [';', 'a']);
  await page.click('#foafos-home .foafos-app[data-app="chat"]', { button: 'right' });
  const rsheet = await page.evaluate(() => document.querySelector('.foafos-app-sheet h3')?.textContent);
  await page.keyboard.press('Escape');
  const rafter = await page.evaluate(() => ({ sheet: !!document.querySelector('.foafos-app-sheet'), home: !!document.getElementById('foafos-home'), focus: document.activeElement?.dataset?.app }));
  await page.evaluate(() => document.getElementById('foafos-home')?.remove());
  check(rsheet === 'Chat' && !rafter.sheet && rafter.home && rafter.focus === 'chat', `right-click on an app shows its sheet; Escape puts it away and stays in All apps (${rsheet}, ${JSON.stringify(rafter)})`);

  // What you open comes to the front
  await page.evaluate(() => FoafOS.launchApp('chat'));
  await page.waitForTimeout(800);
  await page.evaluate(() => FoafOS.launchApp('system'));
  await page.waitForTimeout(500);
  check(await onTop(page, '#foafos-session-win'), 'what you open comes to the front');

  // All apps marks the apps that are open, as a dock does, and says so to a screen reader
  await keys(page, [';', 'a']);
  const marks = await page.evaluate(() => {
    const b = (id) => document.querySelector(`#foafos-home .foafos-app[data-app="${id}"]`);
    const dot = (id) => getComputedStyle(b(id).querySelector('.ico'), '::after').content;
    return { chat: b('chat')?.classList.contains('running'), system: b('system')?.classList.contains('running'), files: b('files')?.classList.contains('running'),
      label: b('chat')?.getAttribute('aria-label'), dot: dot('chat'), noDot: dot('files') };
  });
  await page.keyboard.press('Escape');
  check(marks.chat && marks.system && !marks.files && /^Chat, open/.test(marks.label) && marks.dot === '""' && marks.noDot === 'none',
    `All apps marks the open apps (${JSON.stringify(marks)})`);

  // A window comes back where it was left (dragged a little, so it stays wholly on screen: a window
  // left partly off screen comes back pulled on, by design)
  const bar = await page.evaluate(() => { const r = document.querySelector('#foafos-session-win .foafos-window-bar span').getBoundingClientRect(); return { x: r.x + 10, y: r.y + r.height / 2 }; });
  await page.mouse.move(bar.x, bar.y); await page.mouse.down();
  await page.mouse.move(bar.x + 150, bar.y + 30, { steps: 6 }); await page.mouse.up();
  const movedTo = await page.evaluate(() => { const r = document.getElementById('foafos-session-win').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; });
  await page.evaluate(() => document.querySelector('#foafos-session-win .foafos-window-close').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => FoafOS.launchApp('system'));
  await page.waitForTimeout(500);
  const reopenedAt = await page.evaluate(() => { const r = document.getElementById('foafos-session-win').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; });
  check(String(movedTo) === String(reopenedAt), `a window reopens where it was left (${movedTo} then ${reopenedAt})`);
  // Closed while maximised, it opens maximised; restored and closed, it opens where it was
  const reopenSystem = async () => {
    await page.evaluate(() => document.querySelector('#foafos-session-win .foafos-window-close').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => FoafOS.launchApp('system'));
    await page.waitForTimeout(500);
    return page.evaluate(() => { const w = document.getElementById('foafos-session-win'), r = w.getBoundingClientRect(); return { max: w.classList.contains('maximized'), at: [Math.round(r.x), Math.round(r.y)].join(',') }; });
  };
  await page.evaluate(() => document.querySelector('#foafos-session-win .foafos-window-max').click());
  const asMax = await reopenSystem();
  await page.evaluate(() => document.querySelector('#foafos-session-win .foafos-window-max').click());
  const asFloat = await reopenSystem();
  check(asMax.max && !asFloat.max && asFloat.at === String(reopenedAt), `a window closed maximised opens maximised, and restored opens where it was (${JSON.stringify(asMax)}, ${JSON.stringify(asFloat)})`);

  // Ctrl ; h minimises the front window and brings another forward
  const hid = await page.evaluate(() => document.getElementById('foafos-session-win').dataset.wid);
  await page.evaluate(() => FoafOS.raiseWindow(document.getElementById('foafos-session-win')));
  await keys(page, [';', 'h']);
  const afterHide = await page.evaluate((w) => ({ min: document.querySelector(`.foafos-window[data-wid="${w}"]`).classList.contains('minimized'), front: [...document.querySelectorAll('.foafos-window:not(.minimized)')].some((x) => x.style.zIndex === '2640') }), hid);
  check(afterHide.min && afterHide.front, `ctrl ; h minimises the front window and another comes forward (${JSON.stringify(afterHide)})`);
  await page.evaluate(() => { const w = document.getElementById('foafos-session-win'); w.querySelector('.foafos-window-min').click(); FoafOS.raiseWindow(w); });

  // Ctrl ; q closes the front window, and another comes forward
  await page.evaluate(() => FoafOS.launchApp('chat'));
  await page.waitForTimeout(600);
  const frontBefore = await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].find((x) => x.style.zIndex === '2640')?.dataset.wid);
  const nBeforeClose = await page.evaluate(() => document.querySelectorAll('.foafos-window').length);
  await page.evaluate((w) => { window.__closedAs = document.querySelector(`.foafos-window[data-wid="${w}"]`)?.dataset.openedAs; }, frontBefore);
  await keys(page, [';', 'q']);
  await page.waitForTimeout(400);
  const afterClose = await page.evaluate((w) => ({ n: document.querySelectorAll('.foafos-window').length, gone: !document.querySelector(`.foafos-window[data-wid="${w}"]`), front: [...document.querySelectorAll('.foafos-window:not(.minimized)')].some((x) => x.style.zIndex === '2640') }), frontBefore);
  check(afterClose.n === nBeforeClose - 1 && afterClose.gone && afterClose.front, `ctrl ; q closes the front window and another comes forward (${nBeforeClose} → ${JSON.stringify(afterClose)})`);

  // Ctrl ; u reopens the app closed last, and the menu row names it
  const closedAs = await page.evaluate((w) => window.__closedAs, frontBefore);
  const rowText = await page.evaluate(() => { const r = document.getElementById('wm-sys-reopen'); return r.hidden ? null : r.querySelector('.wm-label').textContent; });
  await keys(page, [';', 'u']);
  await page.waitForTimeout(600);
  const back = await page.evaluate((id) => ({ n: document.querySelectorAll('.foafos-window').length, there: !!document.querySelector(`.foafos-window[data-opened-as="${id}"]`) }), closedAs);
  check(!!closedAs && /^Reopen \S/.test(rowText || '') && rowText !== 'Reopen closed app' && back.n === nBeforeClose && back.there,
    `ctrl ; u reopens the closed app (${closedAs}, "${rowText}", ${nBeforeClose} → ${JSON.stringify(back)})`);
  // Reopening everything left empties the list: the row hides, and the key then does nothing
  for (let i = 0; i < 10 && await page.evaluate(() => !document.getElementById('wm-sys-reopen').hidden); i++) { await keys(page, [';', 'u']); await page.waitForTimeout(300); }
  const nAll = await page.evaluate(() => document.querySelectorAll('.foafos-window').length);
  await keys(page, [';', 'u']);
  check(await page.evaluate(() => document.getElementById('wm-sys-reopen').hidden) && await page.evaluate(() => document.querySelectorAll('.foafos-window').length) === nAll, 'with nothing left to reopen, the row hides and ctrl ; u does nothing');
  await page.evaluate(() => { if (!document.getElementById('foafos-session-win')) FoafOS.launchApp('system'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => FoafOS.raiseWindow(document.getElementById('foafos-session-win')));

  // Ctrl ; j brings the next window to the front, and round again
  const front = () => page.evaluate(() => [...document.querySelectorAll('.foafos-window')].find((w) => w.style.zIndex === '2640')?.dataset.wid);
  const f0 = await front();
  await keys(page, [';', 'j']);
  const f1 = await front();
  const n = await page.evaluate(() => document.querySelectorAll('.foafos-window:not(.minimized)').length);
  for (let i = 1; i < n; i++) await keys(page, [';', 'j']);
  check(f1 && f1 !== f0 && (await front()) === f0, `ctrl ; j brings the next window forward and cycles (${n} windows)`);
  await keys(page, [';', 'j']);
  await keys(page, [';', 'k']);
  check((await front()) === f0, 'ctrl ; k goes back to the window before');
  // Ctrl ; ; goes back to the window used last, and again comes back, as a single Alt+Tab does
  const wins2 = await page.evaluate(() => [...document.querySelectorAll('.foafos-window:not(.minimized)')].slice(0, 3).map((w) => w.dataset.wid));
  await page.evaluate((ids) => { for (const id of ids) FoafOS.raiseWindow(document.querySelector(`.foafos-window[data-wid="${id}"]`)); }, wins2);   // last raised: wins2[2], before it wins2[1]
  await keys(page, [';', ';']);
  const l1 = await front();
  await keys(page, [';', ';']);
  const l2 = await front();
  check(wins2.length === 3 && l1 === wins2[1] && l2 === wins2[2], `ctrl ; ; goes back to the window used last, and again returns (${wins2} → ${l1} → ${l2})`);
  // Held, it is a switcher: with Ctrl still down after Ctrl ; ;, a strip of recent windows shows;
  // ; again moves on; letting go of Ctrl goes to the one marked; Escape stays put
  await page.evaluate((ids) => { for (const id of ids) FoafOS.raiseWindow(document.querySelector(`.foafos-window[data-wid="${id}"]`)); }, wins2);
  await page.keyboard.down('Control');
  await page.keyboard.press(';'); await page.keyboard.press(';');
  await page.waitForTimeout(150);
  const swShown = await page.evaluate(() => ({ n: document.querySelectorAll('#foafos-switch .foafos-sw-card').length, at: [...document.querySelectorAll('#foafos-switch .foafos-sw-card')].findIndex((c) => c.classList.contains('on')) }));
  await page.keyboard.press(';');
  const swAt2 = await page.evaluate(() => [...document.querySelectorAll('#foafos-switch .foafos-sw-card')].findIndex((c) => c.classList.contains('on')));
  const swSaid = await page.evaluate(() => ({ text: document.getElementById('foafos-sw-say')?.textContent, live: document.getElementById('foafos-sw-say')?.getAttribute('aria-live'), card: document.querySelector('#foafos-switch .foafos-sw-card.on')?.textContent, n: document.querySelectorAll('#foafos-switch .foafos-sw-card').length }));
  await page.keyboard.up('Control');
  await page.waitForTimeout(200);
  const swFront = await front();
  const swGone = await page.evaluate(() => !document.getElementById('foafos-switch'));
  await page.keyboard.down('Control');
  await page.keyboard.press(';'); await page.keyboard.press(';');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Control');
  await page.waitForTimeout(150);
  const swStayed = await front();
  check(swShown.n >= 3 && swShown.at === 1 && swAt2 === 2 && swSaid.live === 'polite' && swSaid.text === `${swSaid.card}, 3 of ${swSaid.n}` && swFront === wins2[0] && swGone && swStayed === wins2[0],
    `held Ctrl ; ; shows a switcher; ; moves on; letting go switches; Escape stays (${JSON.stringify({ swShown, swAt2, swSaid, swFront, want: wins2[0], swStayed })})`);
  await page.evaluate(() => FoafOS.raiseWindow(document.getElementById('foafos-session-win')));

  // Task Manager: switching to a minimised window restores it
  await page.evaluate(() => FoafOS.launchApp('files'));
  await page.waitForTimeout(800);
  const filesWid = await page.evaluate(() => { const w = [...document.querySelectorAll('.foafos-window')].find((x) => x.querySelector('iframe')?.src.includes('apps/files/')); w.querySelector('.foafos-window-min').click(); return w.dataset.wid; });
  await page.evaluate(() => FoafOS.openSwitcher());
  await page.waitForTimeout(300);
  await page.click('#foafos-switcher button[aria-label="Switch to Files"]');
  await page.waitForTimeout(300);
  check(await page.evaluate((w) => { const el = document.querySelector(`.foafos-window[data-wid="${w}"]`); return !el.classList.contains('minimized') && el.style.zIndex === '2640'; }, filesWid), 'Task Manager brings a minimised window back');
  await page.evaluate(() => FoafOS.raiseWindow(document.getElementById('foafos-session-win')));

  // Ctrl ; p opens Task Manager, and again closes it
  await keys(page, [';', 'p']);
  const tmOpen = await page.isVisible('#foafos-switcher');
  await keys(page, [';', 'p']);
  check(tmOpen && !(await page.isVisible('#foafos-switcher')), 'ctrl ; p opens Task Manager and closes it again');

  // Option+H on a Mac types "˙": All apps opens by the key's position
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '˙', code: 'KeyH', altKey: true, bubbles: true })));
  await page.waitForTimeout(300);
  check(await page.isVisible('#foafos-home'), 'Option+H opens All apps on a Mac layout');
  await page.evaluate(() => document.getElementById('foafos-home')?.remove());

  // Back (a phone's, or the browser's) closes All apps and All windows, and the shell stays;
  // closed another way, they leave no history entry behind
  const url0 = page.url();
  await keys(page, [';', 'a']);
  const homeOpen = await page.isVisible('#foafos-home');
  await page.evaluate(() => history.back()); await page.waitForTimeout(400);
  const homeAfterBack = await page.evaluate(() => ({ home: !!document.getElementById('foafos-home'), shell: !!window.FoafOS?.launchApp, overlayState: !!history.state?.foafosOverlay }));
  await keys(page, [';', 's']); await page.waitForTimeout(500);
  const ovOpen = await page.evaluate(() => document.body.classList.contains('foafos-overview-on'));
  await page.evaluate(() => history.back()); await page.waitForTimeout(600);
  const ovAfterBack = await page.evaluate(() => document.body.classList.contains('foafos-overview-on'));
  await keys(page, [';', 'a']);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const afterEscape = await page.evaluate(() => ({ home: !!document.getElementById('foafos-home'), overlayState: !!history.state?.foafosOverlay }));
  check(homeOpen && !homeAfterBack.home && homeAfterBack.shell && !homeAfterBack.overlayState && ovOpen && !ovAfterBack && !afterEscape.home && !afterEscape.overlayState && page.url() === url0,
    `Back closes All apps and All windows, and the shell stays (${JSON.stringify({ homeAfterBack, ovAfterBack, afterEscape })})`);

  // Ctrl ; v moves and resizes the front window with the keyboard; Enter keeps it, Escape puts it back
  await page.evaluate(() => { const w = document.getElementById('foafos-session-win'); if (w.classList.contains('maximized')) w.querySelector('.foafos-window-max').click(); Object.assign(w.style, { left: '200px', top: '120px' }); FoafOS.raiseWindow(w); });
  const kbox = () => page.evaluate(() => { const r = document.getElementById('foafos-session-win').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
  const k0 = await kbox();
  await keys(page, [';', 'v']);
  const hinted = await page.evaluate(() => document.getElementById('foafos-keymove')?.textContent || '');
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'Shift+ArrowRight', 'Shift+ArrowDown']) await page.keyboard.press(k);
  await page.keyboard.press('Enter');
  const k1 = await kbox();
  await keys(page, [';', 'v']);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  const k2 = await kbox();
  const gone = await page.evaluate(() => !document.getElementById('foafos-keymove') && !document.querySelector('.foafos-keymoving') && document.body.classList.contains('foafos-overview-on') === false);
  check(/^Moving .*Enter keeps it/.test(hinted) && k1[0] === k0[0] + 48 && k1[1] === k0[1] + 24 && k1[2] === k0[2] + 24 && k1[3] === k0[3] + 24 && String(k2) === String(k1) && gone,
    `ctrl ; v moves and resizes with the keyboard; Escape puts it back (${k0} → ${k1} → ${k2})`);

  // Right-click a title bar: the window menu lists what can be done, with its keys; it does it
  await page.evaluate(() => { const w = document.getElementById('foafos-session-win'); if (w.classList.contains('maximized')) w.querySelector('.foafos-window-max').click(); FoafOS.raiseWindow(w); });
  const barAt = await page.evaluate(() => { const r = document.querySelector('#foafos-session-win .foafos-window-bar span').getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; });
  await page.mouse.click(barAt.x, barAt.y, { button: 'right' });
  const wmenu = await page.evaluate(() => [...document.querySelectorAll('#foafos-win-menu button')].map((b) => `${b.firstChild.textContent}=${b.lastChild.textContent}`));
  const focusIn = await page.evaluate(() => document.activeElement?.closest('#foafos-win-menu') !== null);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  const menuGone = await page.evaluate(() => !document.getElementById('foafos-win-menu'));
  await page.mouse.click(barAt.x, barAt.y, { button: 'right' });
  await page.evaluate(() => [...document.querySelectorAll('#foafos-win-menu button')].find((b) => /Minimise/.test(b.textContent)).click());
  const minimised = await page.evaluate(() => document.getElementById('foafos-session-win').classList.contains('minimized'));
  await page.evaluate(() => { const w = document.getElementById('foafos-session-win'); w.querySelector('.foafos-window-min').click(); FoafOS.raiseWindow(w); });
  check(String(wmenu) === 'Snap left=Ctrl ; l,Snap right=Ctrl ; r,Next quarter=Ctrl ; i,Maximise=Ctrl ; m,Keep on top=,Move to workspace 2=,Minimise=Ctrl ; h,Minimise the others=,Move or resize=Ctrl ; v,Close=Ctrl ; q' && focusIn && menuGone && minimised,
    `right-click on a title bar opens the window menu with its keys, and it acts (${wmenu}, ${focusIn}, ${menuGone}, ${minimised})`);

  // Snapping
  const box = () => page.evaluate(() => { const r = document.getElementById('foafos-session-win').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
  await keys(page, [';', 'l']);
  check(String(await box()) === '0,0,640,800', 'ctrl ; l snaps left, full height');
  await keys(page, [';', 'r']);
  check(String(await box()) === '640,0,640,800', 'ctrl ; r snaps right');
  // Ctrl ; i steps the front window round the quarters: top-left, top-right, bottom-right, bottom-left
  const qs = [];
  for (let k = 0; k < 4; k++) { await keys(page, [';', 'i']); qs.push(String(await box())); }
  check(qs.join(' | ') === '0,0,640,400 | 640,0,640,400 | 640,400,640,400 | 0,400,640,400', `ctrl ; i steps through the quarters (${qs.join(' | ')})`);
  await keys(page, [';', 'r']);   // back as the tests below expect
  // When the page gets smaller, a snapped window fills its half of the new size, and a floating
  // window that would be left off the edge comes back on screen; both follow it back up.
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.waitForTimeout(300);
  const snappedSmall = String(await box());
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  const snappedBack = String(await box());
  const other = await page.evaluate(() => [...document.querySelectorAll('.foafos-window:not(.minimized)')].find((w) => w.id !== 'foafos-session-win' && !w.classList.contains('maximized'))?.dataset.wid);
  await page.evaluate((w) => Object.assign(document.querySelector(`.foafos-window[data-wid="${w}"]`).style, { left: '900px', top: '500px' }), other);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.waitForTimeout(300);
  const floated = await page.evaluate((w) => { const r = document.querySelector(`.foafos-window[data-wid="${w}"]`).getBoundingClientRect(); return { right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; }, other);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  check(snappedSmall === '500,0,500,700' && snappedBack === '640,0,640,800' && !!other && floated.right <= Math.max(800, floated.w) && floated.bottom <= Math.max(600, floated.h),
    `windows refit when the page changes size (${snappedSmall}, ${snappedBack}, ${JSON.stringify(floated)})`);
  // Dragged into a corner, a window fills that quarter
  await keys(page, [';', 'm']);
  await page.evaluate(() => document.querySelector('#foafos-session-win .foafos-window-max').click());   // back from maximised
  await page.waitForTimeout(200);
  const grip = await page.evaluate(() => { const r = document.querySelector('#foafos-session-win .foafos-window-bar span').getBoundingClientRect(); return { x: r.x + 5, y: r.y + r.height / 2 }; });
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  await page.mouse.move(1275, 795, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(200);
  check(String(await box()) === '640,400,640,400', `a window dragged to the bottom-right corner fills that quarter (${await box()})`);
  await keys(page, [';', 'm']);
  check(await page.evaluate(() => document.querySelector('#foafos-session-win .foafos-window-max').getAttribute('aria-pressed')) === 'true', 'ctrl ; m uses the real Maximize');
  const maxed = () => page.evaluate(() => document.getElementById('foafos-session-win').classList.contains('maximized'));
  await page.dblclick('#foafos-session-win .foafos-window-bar span');
  check(!(await maxed()), 'double-clicking the title bar restores');
  await page.dblclick('#foafos-session-win .foafos-window-bar span');
  check(await maxed(), 'and double-clicking again maximises');
  await page.click('#foafos-session-win .foafos-window-min');
  await page.dblclick('#foafos-session-win .foafos-window-bar span');
  check(await page.evaluate(() => !document.getElementById('foafos-session-win').classList.contains('minimized')), 'double-clicking a minimised title bar brings the window back');

  // Menu and All windows
  await keys(page, [';', 'f', 'o', 'a', 'f']);
  check(await page.evaluate(() => !document.getElementById('wm-chrome').classList.contains('collapsed')), 'ctrl ; f o a f opens the menu');
  check(await page.evaluate(() => document.querySelectorAll('#wm-open-sect button').length) >= 2, 'the menu lists open windows');
  check(await page.evaluate(() => ['wm-sys-keys', 'wm-sys-move'].every((id) => getComputedStyle(document.getElementById(id)).display !== 'none')), 'with a mouse and keyboard the menu keeps Keys and Move or resize');
  check(await page.evaluate(() => ['wm-sys-apps', 'wm-sys-windows', 'wm-sys-next', 'wm-sys-tasks', 'wm-sys-hide', 'wm-sys-close', 'wm-sys-prev'].every((id) => /^Ctrl ; /.test(document.querySelector(`#${id} .wm-keys`)?.textContent || '') && document.querySelector(`#${id} .wm-keys`).offsetWidth > 0)), 'the menu shows each row\'s keys');
  // Ctrl ; / (or Keys in the menu) lists every key sequence with what it does; Escape shuts it
  await page.keyboard.press('Escape');
  await keys(page, [';', '/']);
  const sheetRows = await page.evaluate(() => [...document.querySelectorAll('#wm-keys-sheet tr')].map((r) => `${r.cells[0].textContent}=${r.cells[1].textContent}`));
  await page.keyboard.press('Escape');
  const sheetGone = await page.evaluate(() => !document.getElementById('wm-keys-sheet'));
  check(sheetRows.length >= 15 && sheetRows.includes('All apps=Ctrl ; a') && sheetRows.includes('Last window, and back (hold Ctrl to choose)=Ctrl ; ;') && sheetRows.includes('This list of keys=Ctrl ; /') && sheetGone,
    `ctrl ; / shows every key with what it does (${sheetRows.length}: ${sheetRows.slice(0, 3).join(', ')}...)`);
  await page.evaluate(() => FinkWM._setCollapsed(true));
  await keys(page, [';', 's']);
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => document.querySelectorAll('.foafos-ov-close').length);
  check(before >= 2, 'ctrl ; s shows cards with close buttons');
  check(/press 1–\d, or type a name/.test(await page.evaluate(() => document.querySelector('#foafos-ov-strip span')?.textContent || '')), 'All windows with a keyboard says which keys');
  await page.evaluate(() => document.querySelector('.foafos-ov-close').click());
  await page.waitForTimeout(1000);
  check(await page.evaluate(() => document.querySelectorAll('.foafos-ov-close').length) === before - 1, 'closing a card leaves All windows open on the rest');
  // Typing a name narrows the cards; Backspace and Escape take it back before Escape leaves
  const names = await page.evaluate(() => [...document.querySelectorAll('.foafos-ov-hit')].map((h) => h.dataset.find));
  const target = names.find((n) => /system/.test(n));
  await page.keyboard.type('syst');
  const narrowed = await page.evaluate(() => ({ shown: [...document.querySelectorAll('.foafos-ov-hit')].filter((h) => !h.parentElement.classList.contains('foafos-ov-dim')).map((h) => h.dataset.find), focus: document.activeElement?.dataset?.find, said: document.querySelector('.foafos-ov-find').textContent }));
  await page.keyboard.type('zz');
  const none = await page.evaluate(() => ({ said: document.querySelector('.foafos-ov-find').textContent, dim: document.querySelectorAll('.foafos-ov-dim').length }));
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  await page.keyboard.press('Escape');
  const cleared = await page.evaluate(() => ({ on: document.body.classList.contains('foafos-overview-on'), dim: document.querySelectorAll('.foafos-ov-dim').length, said: document.querySelector('.foafos-ov-find').textContent }));
  check(!!target && narrowed.shown.every((n) => n.includes('syst')) && narrowed.shown.length < names.length && narrowed.focus === target && narrowed.said === '“syst”'
    && /No window is called “systzz”/.test(none.said) && none.dim === names.length && cleared.on && cleared.dim === 0 && cleared.said === '',
    `typing a name in All windows narrows the cards; Escape clears it first (${names.join('|')} → ${narrowed.shown.join('|')}, ${JSON.stringify(none)}, ${JSON.stringify(cleared)})`);
  // No window by a name, but an app: All windows offers it, and Enter opens it
  await page.keyboard.type('activ');
  const offerSaid = await page.evaluate(() => document.querySelector('.foafos-ov-find').textContent);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  const opened = await page.evaluate(() => ({ ov: document.body.classList.contains('foafos-overview-on'), activity: !!document.querySelector('.foafos-window[data-opened-as="activity"]') }));
  check(/Enter opens Activity/.test(offerSaid) && !opened.ov && opened.activity, `All windows offers an app when no window has the name, and Enter opens it (${offerSaid}, ${JSON.stringify(opened)})`);
  await page.evaluate(() => document.querySelector('.foafos-window[data-opened-as="activity"] .foafos-window-close')?.click());
  await page.waitForTimeout(200);
  await keys(page, [';', 's']);
  await page.waitForTimeout(500);
  // A number key picks that card
  const second = await page.evaluate(() => document.querySelectorAll('.foafos-ov-hit')[1]?.closest('.foafos-window')?.dataset.wid);
  check(await page.evaluate(() => document.querySelectorAll('.foafos-ov-num b').length) >= 1, 'cards show their number');
  check(await page.evaluate(() => [...document.querySelectorAll('.foafos-ov-num span')].some((t) => /System/.test(t.textContent) && t.getBoundingClientRect().height >= 14)), 'cards show their window name at a readable size');
  await page.keyboard.press('2');
  await page.waitForTimeout(600);
  check(!(await page.evaluate(() => document.body.classList.contains('foafos-overview-on'))) && (await page.evaluate((w) => document.querySelector(`.foafos-window[data-wid="${w}"]`)?.style.zIndex, second)) === '2640', 'pressing 2 picks the second card');
  await page.evaluate(() => document.getElementById('foafos-ov-done')?.click());
  await page.waitForTimeout(500);

  // A minimised window is still a card, and picking it restores it
  const minWin = await page.evaluate(() => {
    const w = [...document.querySelectorAll('.foafos-window')].pop();
    w.querySelector('.foafos-window-min').click();
    return w.dataset.wid;
  });
  await keys(page, [';', 's']);
  await page.waitForTimeout(600);
  const card = `.foafos-window[data-wid="${minWin}"] .foafos-ov-hit`;
  check(await page.evaluate((c) => /minimised/.test(document.querySelector(c)?.getAttribute('aria-label') || ''), card), 'a minimised window has a card in All windows');
  await page.click(card);                      // a real click, as a person would
  await page.waitForTimeout(600);
  check(await page.evaluate((w) => { const el = document.querySelector(`.foafos-window[data-wid="${w}"]`); return !el.classList.contains('minimized') && el.style.zIndex === '2640'; }, minWin), 'picking it restores it to the front');

  // Widgets are apps here too: an open one is marked, and a closed one can be reopened
  await page.evaluate(() => FoafOS.openWidget('tally'));
  await page.waitForTimeout(500);
  await keys(page, [';', 'a']);
  const tallyMarked = await page.evaluate(() => document.querySelector('#foafos-home .foafos-app[data-app="widget-tally"]')?.classList.contains('running'));
  await page.keyboard.press('Escape');
  const tallyCount = () => page.evaluate(() => document.querySelectorAll('.foafos-window[data-opened-as="widget-tally"]').length);
  const nTally = await tallyCount();
  await page.evaluate(() => [...document.querySelectorAll('.foafos-window[data-opened-as="widget-tally"]')].pop().querySelector('.foafos-window-close').click());
  await page.waitForTimeout(300);
  const reopenRow = await page.evaluate(() => document.querySelector('#wm-sys-reopen .wm-label')?.textContent);
  await keys(page, [';', 'u']);
  await page.waitForTimeout(500);
  check(tallyMarked && reopenRow === 'Reopen Tally' && await tallyCount() === nTally, `an open widget is marked in All apps, and a closed one reopens (${tallyMarked}, ${reopenRow}, ${nTally})`);
  // Task Manager lists open widgets too, and Show brings one forward
  await page.evaluate(() => { document.getElementById('foafos-switcher')?.remove(); FoafOS.openSwitcher(); });
  await page.waitForTimeout(400);
  const tmW = await page.evaluate(() => [...document.querySelectorAll('#foafos-switcher .foafos-tm-widgets li > span')].map((x) => x.textContent));
  const tmTarget = await page.evaluate(() => [...document.querySelectorAll('.foafos-window[data-opened-as="widget-tally"]')][0]?.dataset.wid);
  await page.evaluate(() => document.querySelector('#foafos-switcher .foafos-tm-widgets li button').click());
  await page.waitForTimeout(300);
  const tmAfter = await page.evaluate((w) => ({ gone: !document.getElementById('foafos-switcher'), front: document.querySelector(`.foafos-window[data-wid="${w}"]`)?.style.zIndex === '2640' }), tmTarget);
  check(tmW.length >= 1 && tmW.every((t) => /Tally/.test(t)) && tmAfter.gone && tmAfter.front, `Task Manager lists open widgets, and Show brings one forward (${JSON.stringify({ tmW, tmAfter })})`);

  // Snap assist: snapping a window to the left half offers the other windows for the right half;
  // picking one fills it; a key elsewhere dismisses the offer
  await page.evaluate(() => { const w = document.getElementById('foafos-session-win'); if (w.classList.contains('maximized')) w.querySelector('.foafos-window-max').click(); FoafOS.raiseWindow(w); });
  await keys(page, [';', 'l']);
  const offer = await page.evaluate(() => { const b = document.getElementById('foafos-snap-assist'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x), names: [...b.querySelectorAll('button')].map((x) => x.textContent) }; });
  const pickedWid = await page.evaluate(() => { const b = document.querySelector('#foafos-snap-assist button'); const name = b.textContent; b.click(); return [...document.querySelectorAll('.foafos-window')].find((w) => w.querySelector('.foafos-window-bar span')?.textContent === name)?.dataset.wid; });
  await page.waitForTimeout(200);
  const filled = await page.evaluate((w) => { const r = document.querySelector(`.foafos-window[data-wid="${w}"]`).getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); }, pickedWid);
  await keys(page, [';', 'r']);
  const offered2 = await page.evaluate(() => !!document.getElementById('foafos-snap-assist'));
  await page.keyboard.press('Shift');
  const dismissed = await page.evaluate(() => !document.getElementById('foafos-snap-assist'));
  check(offer && offer.x >= 640 && offer.names.length >= 1 && filled === '640,0,640,800' && offered2 && dismissed,
    `snap assist offers the other windows for the other half, and fills it (${JSON.stringify({ offer, filled, offered2, dismissed })})`);
  // By the keys: Ctrl ; l puts the focus on the offer; Down and Enter fill the other half; another key
  // puts it away and the focus goes back to the snapped window
  await page.evaluate(() => { const w = document.getElementById('foafos-session-win'); if (w.classList.contains('maximized')) w.querySelector('.foafos-window-max').click(); FoafOS.raiseWindow(w); });
  await keys(page, [';', 'l']);
  const kFocus = await page.evaluate(() => !!document.activeElement?.closest('#foafos-snap-assist'));
  const kSecond = await page.evaluate(() => document.querySelectorAll('#foafos-snap-assist button')[1]?.textContent);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const kFilled = await page.evaluate((name) => { const w = [...document.querySelectorAll('.foafos-window')].find((x) => x.querySelector('.foafos-window-bar span')?.textContent === name); const r = w?.getBoundingClientRect(); return r ? [r.x, r.y, r.width, r.height].map(Math.round).join(',') : null; }, kSecond);
  await page.evaluate(() => FoafOS.raiseWindow(document.getElementById('foafos-session-win')));
  await keys(page, [';', 'l']);
  await page.keyboard.press('x');
  const kBack = await page.evaluate(() => ({ gone: !document.getElementById('foafos-snap-assist'), inWin: !!document.activeElement?.closest('#foafos-session-win') }));
  check(kFocus && !!kSecond && kFilled === '640,0,640,800' && kBack.gone && kBack.inWin, `snap assist by the keys: focus on the offer, Down and Enter pick, another key returns (${JSON.stringify({ kFocus, kSecond, kFilled, kBack })})`);

  // Resize from any edge, in a page of its own: the left edge dragged left widens the window
  // leftwards; the top edge dragged down makes it shorter from the top
  {
    const { ctx: ectx, page: ep } = await open({ width: 1280, height: 800 });
    await ep.evaluate(() => FoafOS.launchApp('system'));
    await ep.waitForTimeout(600);
    await ep.evaluate(() => { const w = document.getElementById('foafos-session-win'); if (w.classList.contains('maximized')) w.querySelector('.foafos-window-max').click(); Object.assign(w.style, { left: '300px', top: '150px', width: '460px', height: '400px' }); FoafOS.raiseWindow(w); });
    const ebox = () => ep.evaluate(() => { const r = document.getElementById('foafos-session-win').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
    const edgeAt = (dir) => ep.evaluate((d) => { const r = document.querySelector(`#foafos-session-win .foafos-wedge-${d}`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, dir);
    const dragBy = async (pt, dx, dy) => { await ep.mouse.move(pt.x, pt.y); await ep.mouse.down(); await ep.mouse.move(pt.x + dx, pt.y + dy, { steps: 6 }); await ep.mouse.up(); await ep.waitForTimeout(150); };
    const e0 = await ebox();
    await dragBy(await edgeAt('w'), -60, 0);
    const e1 = await ebox();
    await dragBy(await edgeAt('n'), 0, 40);
    const e2 = await ebox();
    await dragBy(await edgeAt('e'), 30, 0);
    const e3 = await ebox();
    check(e1[0] === e0[0] - 60 && e1[2] === e0[2] + 60 && e1[1] === e0[1] && e2[1] === e1[1] + 40 && e2[3] === e1[3] - 40 && e2[0] === e1[0] && e3[2] === e2[2] + 30 && e3[0] === e2[0],
      `a window resizes from its left, top and right edges (${e0} → ${e1} → ${e2} → ${e3})`);
    // Double-clicking the bottom edge gives the window the full height, keeping its width and place across
    const sPt = await edgeAt('s');
    await ep.mouse.dblclick(sPt.x, sPt.y);
    await ep.waitForTimeout(150);
    const e4 = await ebox();
    check(e4[0] === e3[0] && e4[2] === e3[2] && e4[1] === 0 && e4[3] === 800, `double-clicking the bottom edge gives the full height (${e3} → ${e4})`);
    await ectx.close();
  }

  // Ctrl ; d shows the desktop: every window put away; again, the same ones back, the front one in front
  const openWins = () => page.evaluate(() => [...document.querySelectorAll('.foafos-window:not(.minimized)')].map((w) => w.dataset.wid).sort().join(','));
  const dBefore = await openWins();
  const dFront0 = await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].find((w) => w.style.zIndex === '2640')?.dataset.wid);
  await keys(page, [';', 'd']);
  const dAway = await openWins();
  await keys(page, [';', 'd']);
  const dBack = await openWins();
  const dFront1 = await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].find((w) => w.style.zIndex === '2640')?.dataset.wid);
  check(dBefore.split(',').length >= 2 && dAway === '' && dBack === dBefore && dFront1 === dFront0,
    `ctrl ; d shows the desktop, and again brings the same windows back (${dBefore} → "${dAway}" → ${dBack}; front ${dFront0} → ${dFront1})`);

  // Keep on top (window menu): the window stays over another raised after it, with a pin in its bar
  const ot = await page.evaluate(async () => {
    const sys = document.getElementById('foafos-session-win');
    if (sys.classList.contains('minimized')) sys.querySelector('.foafos-window-min').click();
    if (sys.classList.contains('maximized')) sys.querySelector('.foafos-window-max').click();
    Object.assign(sys.style, { left: '100px', top: '100px', width: '400px', height: '300px' });
    const other = [...document.querySelectorAll('.foafos-window:not(.minimized)')].find((w) => w !== sys && !w.classList.contains('maximized'));
    Object.assign(other.style, { left: '200px', top: '150px', width: '400px', height: '300px' });
    FoafOS.raiseWindow(sys);
    const r = sys.querySelector('.foafos-window-bar span').getBoundingClientRect();
    sys.querySelector('.foafos-window-bar').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 5 }));
    [...document.querySelectorAll('#foafos-win-menu button')].find((b) => /^Keep on top/.test(b.textContent)).click();
    FoafOS.raiseWindow(other);
    const hit = document.elementFromPoint(300, 200)?.closest('.foafos-window');
    const pin = getComputedStyle(sys.querySelector('.foafos-window-bar > span:first-child'), '::before').content;
    const inUse = other.style.zIndex === '2640';
    // and off again
    sys.querySelector('.foafos-window-bar').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 5 }));
    [...document.querySelectorAll('#foafos-win-menu button')].find((b) => /^Stop keeping on top/.test(b.textContent)).click();
    FoafOS.raiseWindow(other);
    const hit2 = document.elementFromPoint(300, 200)?.closest('.foafos-window');
    return { onTop: hit === sys, pin, inUse, after: hit2 === other };
  });
  check(ot.onTop && /📌/.test(ot.pin) && ot.inUse && ot.after, `a window kept on top stays over one raised after it, and can be let go (${JSON.stringify(ot)})`);

  // Workspaces: Ctrl ; . goes to a new, empty one where a window opened stays; Ctrl ; , comes back;
  // All windows shows only this workspace's; the window menu moves a window to another
  const wsShown = () => page.evaluate(() => [...document.querySelectorAll('.foafos-window')].filter((w) => getComputedStyle(w).display !== 'none' && !w.classList.contains('minimized')).map((w) => w.dataset.wid).sort().join(','));
  const ws1 = await wsShown();
  await keys(page, [';', '.']);
  const ws2empty = await wsShown();
  const at2 = await page.evaluate(() => FoafOS.workspaces());
  await page.evaluate(() => FoafOS.openWidget('tally'));
  await page.waitForTimeout(400);
  const ws2 = await wsShown();
  await keys(page, [';', ',']);
  const back1 = await wsShown();
  await keys(page, [';', 's']);
  await page.waitForTimeout(500);
  const wsCards = await page.evaluate(() => document.querySelectorAll('.foafos-ov-hit').length);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const wsMover = ws1.split(',')[0];
  await page.evaluate((w) => { const win = document.querySelector(`.foafos-window[data-wid="${w}"]`); const r = win.querySelector('.foafos-window-bar span').getBoundingClientRect();
    win.querySelector('.foafos-window-bar').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 5 }));
    [...document.querySelectorAll('#foafos-win-menu button')].find((b) => /^Move to workspace 2/.test(b.textContent)).click(); }, wsMover);
  const afterMove = await wsShown();
  await keys(page, [';', '.']);
  const on2 = await wsShown();
  await page.evaluate((w) => { FoafOS.moveToWorkspace(document.querySelector(`.foafos-window[data-wid="${w}"]`), 1); }, wsMover);
  for (const w of on2.split(',').filter((x) => x && x !== wsMover)) await page.evaluate((id) => document.querySelector(`.foafos-window[data-wid="${id}"] .foafos-window-close`)?.click(), w);
  await keys(page, [';', ',']);
  check(ws1.split(',').length >= 2 && ws2empty === '' && at2.at === 2 && ws2.split(',').length === 1 && back1 === ws1 && wsCards === ws1.split(',').length
    && !afterMove.split(',').includes(wsMover) && on2.split(',').includes(wsMover),
    `workspaces: a new empty one, windows stay where they opened, All windows shows this one's, a window moves (${JSON.stringify({ ws1, ws2empty, ws2, back1, wsCards, afterMove, on2 })})`);
  // Ctrl ; g arranges this workspace's windows in a grid that fills the screen, none overlapping
  {
    await keys(page, [';', 'g']);
    await page.waitForTimeout(300);
    const grid = await page.evaluate(() => {
      const rs = [...document.querySelectorAll('.foafos-window:not(.minimized):not(.ws-away)')].map((w) => w.getBoundingClientRect());
      const area = rs.reduce((a, r) => a + r.width * r.height, 0);
      let overlap = 0;
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        overlap += Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      }
      return { n: rs.length, fill: Math.round(100 * area / (innerWidth * innerHeight)), overlap: Math.round(overlap), row: !!document.querySelector('#wm-sys-arrange .wm-keys') };
    });
    check(grid.n >= 2 && grid.fill >= 97 && grid.overlap < 50 && grid.row, `Ctrl ; g arranges the windows side by side, filling the screen (${JSON.stringify(grid)})`);
  }
  // Ctrl ; > takes the front window to the next workspace and goes with it; Ctrl ; < brings it back
  {
    const front = () => page.evaluate(() => [...document.querySelectorAll('.foafos-window:not(.minimized):not(.ws-away)')].sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0]?.dataset.wid);
    const w0 = await front();
    await keys(page, [';', 'Shift+Period']);
    const there = await page.evaluate((w) => ({ at: FoafOS.workspaces().at, ws: document.querySelector(`.foafos-window[data-wid="${w}"]`).dataset.ws }), w0);
    const shown2 = await wsShown();
    await keys(page, [';', 'Shift+Comma']);
    const back = await page.evaluate((w) => ({ at: FoafOS.workspaces().at, ws: document.querySelector(`.foafos-window[data-wid="${w}"]`).dataset.ws }), w0);
    check(w0 && there.at === 2 && there.ws === '2' && shown2 === w0 && back.at === 1 && back.ws === '1' && (await wsShown()) === ws1,
      `Ctrl ; > takes the front window to the next workspace, Ctrl ; < brings it back (${JSON.stringify({ w0, there, shown2, back })})`);
  }
  // In All windows, a middle click on a card closes its window, and so does Delete on a focused card
  {
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const had = new Set([...document.querySelectorAll('.foafos-window')].map((w) => w.dataset.wid));
      FoafOS.openWidget('tally'); FoafOS.openWidget('tally'); await wait(400);
      const mine = [...document.querySelectorAll('.foafos-window')].filter((w) => !had.has(w.dataset.wid)).map((w) => w.dataset.wid);
      const count = () => document.querySelectorAll('.foafos-window:not(.ws-away)').length;
      const n0 = count();
      FoafOS.enterOverview(); await wait(400);
      const card = () => [...document.querySelectorAll('.foafos-ov-hit')].find((h) => mine.includes(h.parentElement.dataset.wid) && h.parentElement.isConnected);
      card().dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true })); await wait(900);
      const n1 = count(), still = document.body.classList.contains('foafos-overview-on');
      card().focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })); await wait(900);
      const n2 = count();
      FoafOS.exitOverview(null); await wait(700);
      return { n0, n1, n2, still };
    });
    check(r.n1 === r.n0 - 1 && r.n2 === r.n0 - 2 && r.still, `All windows: middle click or Delete on a card closes its window (${JSON.stringify(r)})`);
  }
  // Ctrl ; ` goes to the next window of the front window's app, and only that app's
  {
    const ids = await page.evaluate(async () => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const had = new Set([...document.querySelectorAll('.foafos-window')].map((w) => w.dataset.wid));
      FoafOS.openWidget('tally'); await wait(200); FoafOS.openWidget('tally'); await wait(300);
      const mine = [...document.querySelectorAll('.foafos-window')].filter((w) => !had.has(w.dataset.wid));
      FoafOS.raiseWindow(mine[0]); await wait(100);
      return mine.map((w) => w.dataset.wid);
    });
    const frontId = () => page.evaluate(() => [...document.querySelectorAll('.foafos-window:not(.minimized):not(.ws-away)')].find((w) => w.style.zIndex === '2640')?.dataset.wid);
    const f0 = await frontId();
    await keys(page, [';', 'Backquote']);
    const f1 = await frontId();
    await keys(page, [';', 'Backquote']);
    const f2 = await frontId();
    const sameKind = await page.evaluate((ids) => ids.map((id) => document.querySelector(`.foafos-window[data-wid="${id}"]`).dataset.openedAs), [...ids, f1, f2]);
    await page.evaluate((ids) => { for (const id of ids) document.querySelector(`.foafos-window[data-wid="${id}"] .foafos-window-close`)?.click(); }, ids);
    await page.waitForTimeout(300);
    check(ids.length === 2 && new Set(sameKind).size === 1 && f0 === ids[0] && f1 !== f0 && f2 !== f1,
      `Ctrl ; \` steps through the front app's own windows (${JSON.stringify({ ids, f0, f1, f2, sameKind })})`);
  }
  // A right-click on the empty desktop opens the desktop's menu; Widgets opens All apps at its widgets
  {
    await page.evaluate(() => FoafOS.showDesktop());
    await page.waitForTimeout(400);
    const spot = await page.evaluate(() => { for (let y = 60; y < innerHeight - 60; y += 40) for (let x = 60; x < innerWidth - 120; x += 60) { const e = document.elementFromPoint(x, y); if (e === document.body || e?.id === 'narrative-view') return { x, y }; } return null; });
    if (spot) await page.mouse.click(spot.x, spot.y, { button: 'right' });
    await page.waitForTimeout(200);
    const rows = await page.evaluate(() => [...document.querySelectorAll('#foafos-win-menu button span')].map((x) => x.textContent));
    await page.evaluate(() => [...document.querySelectorAll('#foafos-win-menu button')].find((b) => b.textContent.startsWith('Widgets'))?.click());
    await page.waitForTimeout(400);
    const w = await page.evaluate(() => ({ home: !!document.getElementById('foafos-home'), open: !!document.querySelector('#foafos-home details[data-folder="widgets"]')?.open, focus: !!document.activeElement?.closest?.('details[data-folder="widgets"]') }));
    await page.evaluate(() => document.getElementById('foafos-home')?.remove());
    await page.evaluate(() => FoafOS.showDesktop());
    await page.waitForTimeout(400);
    check(spot && rows[0] === 'All apps' && rows.includes('Widgets') && rows.includes('Bring the windows back') && w.home && w.open && w.focus, `a right-click on the desktop opens its menu, and Widgets opens them (${JSON.stringify({ spot, rows, w })})`);
  }
  // All apps search offers to search the files: Files opens and searches all folders for it
  {
    await page.evaluate(() => { document.getElementById('foafos-home')?.remove(); FoafOS.openHome(); });
    await page.waitForTimeout(200);
    await page.fill('#foafos-home .foafos-home-search input', 'zebrafinch');
    await page.waitForTimeout(100);
    const row = await page.evaluate(() => { const b = document.querySelector('.foafos-file-search'); return b && !b.closest('[hidden]') ? b.textContent : null; });
    await page.click('.foafos-file-search');
    let ff = null;
    for (let i = 0; i < 40 && !ff; i++) { ff = page.frames().find((fr) => /apps\/files\//.test(fr.url())); if (!ff) await page.waitForTimeout(250); }
    await ff.evaluate(() => foafos.pod.put('docs/zebrafinch notes.txt', 'about zebrafinches', { contentType: 'text/plain' }));
    await page.evaluate(() => FoafOS.searchInFiles('zebrafinch'));
    const found = await ff.waitForFunction(() => document.querySelector('#items [data-path="docs/zebrafinch notes.txt"]') && document.getElementById('filter').value === 'zebrafinch', null, { timeout: 10000 }).then(() => true, () => false);
    await ff.evaluate(() => foafos.pod.delete('docs/zebrafinch notes.txt'));
    check(/Search files for “zebrafinch”/.test(row || '') && found, `All apps offers to search the files, and Files searches all folders (${row}; ${found})`);
  }
  // All windows shows a button for each workspace; another one's button shows its windows
  const ovws = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    FoafOS.goWorkspace(1);
    const w = [...document.querySelectorAll('.foafos-window:not(.ws-away):not(.minimized)')][0];
    FoafOS.moveToWorkspace(w, 2, { quiet: true });
    FoafOS.enterOverview(); await wait(400);
    const btns = [...document.querySelectorAll('#foafos-ov-strip .foafos-ov-wsbtn')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`);
    document.querySelectorAll('#foafos-ov-strip .foafos-ov-wsbtn')[1].click(); await wait(900);
    const r = { btns, on: document.body.classList.contains('foafos-overview-on'), at: FoafOS.workspaces().at, cards: document.querySelectorAll('.foafos-ov-hit').length,
      pressed: [...document.querySelectorAll('#foafos-ov-strip .foafos-ov-wsbtn')].map((b) => b.getAttribute('aria-pressed')).join() };
    FoafOS.exitOverview(null); await wait(300);
    FoafOS.moveToWorkspace(w, 1, { quiet: true }); FoafOS.goWorkspace(1);
    return r;
  });
  check(String(ovws.btns) === '1:true,2:false' && ovws.on && ovws.at === 2 && ovws.cards === 1 && ovws.pressed === 'false,true', `All windows has a button for each workspace (${JSON.stringify(ovws)})`);
  // A card dragged onto another workspace's button moves its window there
  const dragWs = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    FoafOS.goWorkspace(1);
    const two = [...document.querySelectorAll('.foafos-window:not(.ws-away):not(.minimized)')].slice(0, 2);
    FoafOS.moveToWorkspace(two[0], 2, { quiet: true });       // so there are two workspaces
    FoafOS.enterOverview(); await wait(400);
    const card = two[1].querySelector('.foafos-ov-hit');
    const dt = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
    const target = document.querySelectorAll('#foafos-ov-strip .foafos-ov-wsbtn')[1];
    target.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    const lit = target.classList.contains('drop');
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await wait(600);
    const r = { lit, ws: two[1].dataset.ws, hidden: getComputedStyle(two[1]).display === 'none' };
    FoafOS.exitOverview(null); await wait(300);
    for (const w of two) FoafOS.moveToWorkspace(w, 1, { quiet: true });
    FoafOS.goWorkspace(1);
    return r;
  });
  check(dragWs.lit && dragWs.ws === '2' && dragWs.hidden, `a card dragged onto a workspace button moves its window there (${JSON.stringify(dragWs)})`);
  // Opening an app whose window is on another workspace goes there, rather than raising it out of sight
  const follow = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    FoafOS.goWorkspace(1);
    let chat = document.getElementById('foafos-chat');
    if (!chat) { FoafOS.launchApp('chat'); await wait(500); chat = document.getElementById('foafos-chat'); }
    FoafOS.moveToWorkspace(chat, 2);
    const hiddenHere = getComputedStyle(chat).display === 'none';
    FoafOS.launchApp('chat'); await wait(400);
    const r = { hiddenHere, at: FoafOS.workspaces().at, shown: getComputedStyle(chat).display !== 'none', front: chat.style.zIndex === '2640' };
    FoafOS.moveToWorkspace(chat, 1); FoafOS.goWorkspace(1);
    return r;
  });
  check(follow.hiddenHere && follow.at === 2 && follow.shown && follow.front, `opening an app whose window is on another workspace goes there (${JSON.stringify(follow)})`);

  // Speed: the everyday moves stay quick with ten windows open. Each time includes two frames (about
  // 33 ms), and the limits are generous so a slow machine passes; measured here: All apps 19 ms,
  // All windows 28 ms, raising each of ten windows 11 ms.
  const speed = await page.evaluate(async () => {
    const wait = (ms) => new Promise((x) => setTimeout(x, ms));
    const frame = () => new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
    const time = async (fn) => { const t = performance.now(); fn(); await frame(); return Math.round(performance.now() - t); };
    document.getElementById('foafos-home')?.remove();
    const extra = [];
    while (document.querySelectorAll('.foafos-window:not(.ws-away)').length < 10) { extra.push(FoafOS.openWidget('tally')); await wait(50); }
    await wait(800);
    const out = { windows: document.querySelectorAll('.foafos-window:not(.ws-away)').length };
    out.allApps = await time(() => FoafOS.openHome());
    document.getElementById('foafos-home')?.remove();
    out.allWindows = await time(() => FoafOS.enterOverview());
    FoafOS.exitOverview(null); await wait(400);
    const ws = [...document.querySelectorAll('.foafos-window:not(.ws-away)')];
    out.raiseAll = await time(() => { for (const w of ws) FoafOS.raiseWindow(w); });
    for (const w of extra) w?.querySelector('.foafos-window-close')?.click();
    return out;
  });
  check(speed.windows >= 10 && speed.allApps < 250 && speed.allWindows < 250 && speed.raiseAll < 250, `the everyday moves stay quick with ten windows (${JSON.stringify(speed)} ms)`);

  // The windows you had open come back after a reload; not when the address names an app
  {
    const { ctx: rctx, page: rp } = await open({ width: 1280, height: 800 });
    await rp.evaluate(() => { FoafOS.launchApp('chat'); FoafOS.launchApp('files'); const t = FoafOS.openWidget('tally'); FoafOS.moveToWorkspace(t, 2); });
    await rp.waitForTimeout(800);
    const openNow = () => rp.evaluate(() => [...document.querySelectorAll('.foafos-window[data-opened-as]')].map((w) => w.dataset.openedAs).sort().join(','));
    const before = await openNow();
    await rp.reload();
    await rp.waitForFunction(() => window.FoafOS?.launchApp, null, { timeout: 30000 });
    await rp.waitForTimeout(1500);
    const after = await openNow();
    const tallyWs = await rp.evaluate(() => ({ ws: document.querySelector('.foafos-window[data-opened-as="widget-tally"]')?.dataset.ws, hidden: getComputedStyle(document.querySelector('.foafos-window[data-opened-as="widget-tally"]')).display === 'none', count: FoafOS.workspaces().count }));
    await rp.goto(URL_ + '&app=system');
    await rp.waitForFunction(() => window.FoafOS?.launchApp, null, { timeout: 30000 });
    await rp.waitForTimeout(1500);
    const linked = await openNow();
    await rctx.close();
    check(before.includes('chat') && before.includes('files') && before.includes('widget-tally') && after === before && tallyWs.ws === '2' && tallyWs.hidden && tallyWs.count === 2 && !linked.includes('chat') && linked.includes('system'),
      `the windows you had open come back after a reload, on their workspaces, but not past a link to an app (${before} → ${after}, Tally ${JSON.stringify(tallyWs)}; with ?app=system: ${linked})`);
  }

  // The window menu's "Minimise the others" leaves only that window open on this workspace
  const others = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const open = () => [...document.querySelectorAll('.foafos-window:not(.minimized):not(.ws-away)')];
    const before = open().length;
    const w = open()[0];
    const r = w.querySelector('.foafos-window-bar span').getBoundingClientRect();
    w.querySelector('.foafos-window-bar').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 5 }));
    [...document.querySelectorAll('#foafos-win-menu button')].find((b) => /^Minimise the others/.test(b.textContent)).click();
    await wait(200);
    const left = open();
    const out = { before, left: left.length, same: left[0] === w, front: w.style.zIndex === '2640' };
    for (const m of document.querySelectorAll('.foafos-window.minimized:not(.ws-away)')) m.querySelector('.foafos-window-min')?.click();
    return out;
  });
  check(others.before >= 2 && others.left === 1 && others.same && others.front, `"Minimise the others" leaves one window open (${JSON.stringify(others)})`);

  // Notices
  await page.evaluate(() => { FoafOS.pods.add({ id: 'uxpod', label: 'Ux pod', base: 'https://pod.example/', carriage: 'https', auth: 'bearer' }); FoafOS.pods.setAppsPod('uxpod'); });
  await page.waitForTimeout(400);
  const said = await page.evaluate(() => document.querySelector('#foafos-nudge span')?.textContent || ''); check(/Ux pod/.test(said), `a pod that needs a login says so: ${said}`);
  check(await page.evaluate(() => document.getElementById('wm-chrome').classList.contains('wm-attention')), 'and marks the menu handle');
  check(await page.evaluate(() => { const r = document.getElementById('wm-sys-nudge'); return !r.hidden && /Ux pod.*Open Pods/.test(r.textContent); }), 'and the menu has a row for it');
  check(!errors.length, `no page errors ${errors.slice(0, 2)}`);
  await ctx.close();

  // Phone
  const phone = await open({ width: 390, height: 780 }, true);
  await phone.page.evaluate(() => FoafOS.openSystem());
  await phone.page.waitForTimeout(400);
  // On a touch-only phone, All apps opens without raising the on-screen keyboard
  await phone.page.evaluate(() => FoafOS.openHome());
  await phone.page.waitForTimeout(300);
  check(await phone.page.evaluate(() => document.activeElement?.id === 'foafos-home'), 'All apps on a phone does not open the keyboard');
  check(await phone.page.evaluate(() => ['wm-sys-keys', 'wm-sys-move'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none') && getComputedStyle(document.getElementById('wm-sys-desktop')).display !== 'none'),
    'a phone menu leaves out the rows that need a keyboard (Keys, Move or resize)');
  // and a phone can move between workspaces from the menu, with no keys
  const pws = await phone.page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    FoafOS.goWorkspace(1);
    window.FinkWM._setCollapsed(false); await wait(100);
    const nextRow = document.getElementById('wm-sys-wsnext');
    const r = { nextShown: !nextRow.hidden, prevShown: !document.getElementById('wm-sys-wsprev').hidden };
    nextRow.click(); await wait(200);
    r.at = FoafOS.workspaces().at;
    window.FinkWM._setCollapsed(false); await wait(100);
    r.label = document.querySelector('#wm-sys-wsnext .wm-label').textContent;
    r.prevNow = !document.getElementById('wm-sys-wsprev').hidden;
    document.getElementById('wm-sys-wsprev').click(); await wait(200);
    r.back = FoafOS.workspaces().at;
    return r;
  });
  check(pws.nextShown && !pws.prevShown && pws.at === 2 && pws.prevNow && pws.back === 1, `on a phone the menu moves between workspaces (${JSON.stringify(pws)})`);
  // A long press on an app shows what it does, with Open and Pin, and does not open it
  await phone.page.evaluate(() => { document.getElementById('foafos-home')?.remove(); FoafOS.openHome(); });   // openHome toggles
  await phone.page.waitForTimeout(300);
  const files0 = await phone.page.evaluate(() => document.querySelectorAll('.foafos-window[data-opened-as="files"]').length);
  const appBox = await phone.page.evaluate(() => { const r = document.querySelector('#foafos-home .foafos-app[data-app="files"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const cdp = await phone.ctx.newCDPSession(phone.page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await touch('touchStart', [{ x: appBox.x, y: appBox.y }]);
  await phone.page.waitForTimeout(700);
  await touch('touchEnd', []);
  await phone.page.waitForTimeout(300);
  const sheet = await phone.page.evaluate(() => { const s = document.querySelector('.foafos-app-sheet'); return s && { title: s.querySelector('h3').textContent, desc: s.querySelector('p').textContent, acts: [...s.querySelectorAll('button:not([hidden])')].map((x) => x.textContent) }; });
  const files1 = await phone.page.evaluate(() => document.querySelectorAll('.foafos-window[data-opened-as="files"]').length);
  await phone.page.evaluate(() => document.querySelector('.foafos-app-sheet [data-act="open"]').click());
  await phone.page.waitForTimeout(600);
  const files2 = await phone.page.evaluate(() => document.querySelectorAll('.foafos-window[data-opened-as="files"]').length);
  check(sheet?.title === 'Files' && /files/i.test(sheet.desc) && String(sheet.acts) === (files0 ? `Open,Pin,${files0 === 1 ? 'Close its window' : `Close its ${files0} windows`},Close` : 'Open,Pin,Close') && files1 === files0 && files2 >= files0,
    `a long press on an app shows what it does, and Open opens it (${JSON.stringify(sheet)}, ${files0}/${files1}/${files2})`);
  // Close its windows: every window of that app closes, and its open dot goes
  const quit = await phone.page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.getElementById('foafos-home')?.remove();
    FoafOS.openHome(); await wait(200);
    const b = document.querySelector('#foafos-home .foafos-app[data-app="files"]');
    if (!b) return { none: true };
    const dot0 = b.classList.contains('running');
    b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await wait(100);
    const label = document.querySelector('.foafos-app-sheet [data-act="quit"]')?.textContent;
    document.querySelector('.foafos-app-sheet [data-act="quit"]')?.click(); await wait(600);
    return { dot0, label, left: document.querySelectorAll('.foafos-window[data-opened-as="files"]').length, dot: b.classList.contains('running') };
  });
  check(quit.dot0 && /^Close its/.test(quit.label || '') && quit.left === 0 && !quit.dot, `Close its windows, from an app's sheet, closes them all and the dot goes (${JSON.stringify(quit)})`);
  await phone.page.evaluate(() => document.getElementById('foafos-home')?.remove());

  // Swiping a full-screen window's title bar sideways goes to the next window, and back; a short swipe does not
  await phone.page.evaluate(() => { FoafOS.launchApp('chat'); });
  await phone.page.waitForTimeout(600);
  const pfront = () => phone.page.evaluate(() => [...document.querySelectorAll('.foafos-window')].find((w) => w.style.zIndex === '2640')?.dataset.wid);
  const swipeBar = async (dx) => {
    const r = await phone.page.evaluate(() => { const w = [...document.querySelectorAll('.foafos-window')].find((x) => x.style.zIndex === '2640'); const b = w.querySelector('.foafos-window-bar span').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    const cdp2 = await phone.ctx.newCDPSession(phone.page);
    await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
    for (let k = 1; k <= 5; k++) await cdp2.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x + (dx * k) / 5, y: r.y + 2 }] });
    await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await phone.page.waitForTimeout(300);
  };
  const s0 = await pfront();
  await swipeBar(-30);
  const sShort = await pfront();
  await swipeBar(-120);
  const s1 = await pfront();
  await swipeBar(120);
  const s2 = await pfront();
  check(!!s0 && sShort === s0 && s1 !== s0 && s2 === s0, `on a phone, swiping the title bar sideways goes to the next window and back; a short swipe does not (${s0}, ${sShort}, ${s1}, ${s2})`);
  // A finger held still on a title bar opens the window menu (iOS sends no contextmenu for this)
  await phone.page.evaluate(() => document.getElementById('foafos-win-menu')?.remove());
  const barPt = await phone.page.evaluate(() => { const w = [...document.querySelectorAll('.foafos-window')].find((x) => x.style.zIndex === '2640'); const r = w.querySelector('.foafos-window-bar span').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const hcdp = await phone.ctx.newCDPSession(phone.page);
  await hcdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [barPt] });
  await phone.page.waitForTimeout(800);
  await hcdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await phone.page.waitForTimeout(200);
  const held = await phone.page.evaluate(() => [...document.querySelectorAll('#foafos-win-menu button')].map((b) => b.firstChild.textContent));
  await phone.page.evaluate(() => document.getElementById('foafos-win-menu')?.remove());
  check(held.includes('Minimise') && held.includes('Close'), `on a phone, holding a title bar opens the window menu (${held.join(', ')})`);

  // On a phone a notice sits over the top of the window; a tap elsewhere folds it into the
  // handle, and the menu still has it, so it is not lost
  await phone.page.evaluate(() => document.getElementById('foafos-home')?.remove());
  await phone.page.evaluate(() => FoafOS.launchApp('files'));
  await phone.page.waitForTimeout(1500);
  await phone.page.evaluate(() => { FoafOS.pods.add({ id: 'uxpod2', label: 'Phone pod', base: 'https://pod.example/', carriage: 'https', auth: 'bearer' }); FoafOS.pods.setAppsPod('uxpod2'); });
  await phone.page.waitForTimeout(400);
  const shown = await phone.page.isVisible('#foafos-nudge');
  // the tap lands inside the Files frame, as a person's would
  const inFrame = await phone.page.evaluate(() => document.elementFromPoint(200, 500)?.tagName);
  await phone.page.touchscreen.tap(200, 500);
  await phone.page.waitForTimeout(300);
  const folded = await phone.page.evaluate(() => ({ hidden: !document.querySelector('#foafos-nudge')?.checkVisibility(), row: !document.getElementById('wm-sys-nudge').hidden, ring: document.getElementById('wm-chrome').classList.contains('wm-attention') }));
  check(shown && inFrame === 'IFRAME' && folded.hidden && folded.row && folded.ring, `a phone's notice folds into the handle at a tap in an app and stays in the menu (${shown}, ${inFrame}, ${JSON.stringify(folded)})`);
  await phone.page.evaluate(() => document.getElementById('wm-sys-nudge').click());
  await phone.page.waitForTimeout(600);
  check(await phone.page.evaluate(() => /Pods/.test(document.querySelector('#foafos-session-win .fs-tabs [aria-selected="true"]')?.textContent || '')), 'the menu row does what the notice offered (System, on Pods)');
  await phone.page.evaluate(() => document.getElementById('foafos-home')?.remove());

  // A tap on the empty space around the cards leaves All windows
  await phone.page.evaluate(() => FoafOS.enterOverview());
  await phone.page.waitForTimeout(500);
  const empty = await phone.page.evaluate(() => { for (let y = 780 - 60; y > 100; y -= 20) for (let x = 10; x < 380; x += 20) { const el = document.elementFromPoint(x, y); if (el && !el.closest('.foafos-ov, #foafos-ov-strip, #wm-chrome')) return { x, y }; } return null; });
  await phone.page.mouse.click(empty.x, empty.y);
  await phone.page.waitForTimeout(500);
  check(!(await phone.page.evaluate(() => document.body.classList.contains('foafos-overview-on'))), `a tap on the empty space leaves All windows (${JSON.stringify(empty)})`);

  // Swipe a card up to close its window; a short drag closes nothing
  await phone.page.evaluate(() => { FoafOS.launchApp('chat'); });
  await phone.page.waitForTimeout(800);
  await phone.page.evaluate(() => FoafOS.enterOverview());
  await phone.page.waitForTimeout(600);
  const phoneHint = await phone.page.evaluate(() => document.querySelector('#foafos-ov-strip span')?.textContent || '');
  check(/tap one to open it, or swipe one up to close it/.test(phoneHint) && !/press|type/.test(phoneHint), `All windows on a phone says tap and swipe, not keys (${phoneHint})`);
  const count = () => phone.page.evaluate(() => document.querySelectorAll('.foafos-window').length);
  const nBefore = await count();
  const card0 = await phone.page.evaluate(() => { const r = document.querySelector('.foafos-ov-hit').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await phone.page.mouse.move(card0.x, card0.y); await phone.page.mouse.down();
  await phone.page.mouse.move(card0.x, card0.y - 30, { steps: 4 }); await phone.page.mouse.up();
  await phone.page.waitForTimeout(500);
  const afterShort = await count();
  await phone.page.mouse.move(card0.x, card0.y); await phone.page.mouse.down();
  await phone.page.mouse.move(card0.x, card0.y - 200, { steps: 8 }); await phone.page.mouse.up();
  await phone.page.waitForTimeout(1200);
  const afterLong = await count();
  check(afterShort === nBefore && afterLong === nBefore - 1, `swiping a card up closes its window; a short drag does not (${nBefore}, ${afterShort}, ${afterLong})`);
  await phone.page.evaluate(() => FoafOS.exitOverview?.(null));
  await phone.page.waitForTimeout(400);
  const small = await phone.page.evaluate(() => [...document.querySelectorAll('.foafos-window-btn')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 40).length);
  check(small === 0, 'window buttons are touch sized on a phone');
  // A finger held on the empty desktop opens the desktop's menu (iOS sends no contextmenu)
  {
    await phone.page.evaluate(async () => { document.getElementById('foafos-home')?.remove(); FoafOS.exitOverview(null); await new Promise((ok) => setTimeout(ok, 500)); if (document.querySelector('.foafos-window:not(.minimized):not(.ws-away)')) FoafOS.showDesktop(); });
    await phone.page.waitForTimeout(400);
    const spot = await phone.page.evaluate(() => { for (let y = 120; y < innerHeight - 120; y += 40) for (let x = 40; x < innerWidth - 40; x += 40) { const e = document.elementFromPoint(x, y); if (e === document.body || e?.id === 'narrative-view') return { x, y }; } return null; });
    const lcdp = await phone.ctx.newCDPSession(phone.page);
    if (spot) {
      await lcdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [spot] });
      await phone.page.waitForTimeout(800);
      await lcdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await phone.page.waitForTimeout(200);
    const rows = await phone.page.evaluate(() => [...document.querySelectorAll('#foafos-win-menu button span')].map((x) => x.textContent));
    await phone.page.evaluate(() => { document.getElementById('foafos-win-menu')?.remove(); if (FoafOS.desktopShown()) FoafOS.showDesktop(); });
    await phone.page.waitForTimeout(400);
    check(spot && rows[0] === 'All apps' && rows.includes('Widgets') && !rows.includes('Keys'), `a long press on the empty desktop opens its menu, without Keys on a phone (${JSON.stringify({ spot, rows })})`);
  }
  await phone.ctx.close();
} catch (e) {
  console.log(`FAIL exception: ${e.message}`);
  failed++;
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
