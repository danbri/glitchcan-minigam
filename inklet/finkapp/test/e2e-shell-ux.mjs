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

  // Snapping
  const box = () => page.evaluate(() => { const r = document.getElementById('foafos-session-win').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
  await keys(page, [';', 'l']);
  check(String(await box()) === '0,0,640,800', 'ctrl ; l snaps left, full height');
  await keys(page, [';', 'r']);
  check(String(await box()) === '640,0,640,800', 'ctrl ; r snaps right');
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
  check(await page.evaluate(() => ['wm-sys-apps', 'wm-sys-windows', 'wm-sys-next', 'wm-sys-tasks', 'wm-sys-hide', 'wm-sys-close', 'wm-sys-prev'].every((id) => /^Ctrl ; /.test(document.querySelector(`#${id} .wm-keys`)?.textContent || '') && document.querySelector(`#${id} .wm-keys`).offsetWidth > 0)), 'the menu shows each row\'s keys');
  await page.evaluate(() => FinkWM._setCollapsed(true));
  await keys(page, [';', 's']);
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => document.querySelectorAll('.foafos-ov-close').length);
  check(before >= 2, 'ctrl ; s shows cards with close buttons');
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
  await phone.ctx.close();
} catch (e) {
  console.log(`FAIL exception: ${e.message}`);
  failed++;
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
