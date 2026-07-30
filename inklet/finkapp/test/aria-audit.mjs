#!/usr/bin/env node
// ARIA audit — walks the LIVE app (story + game window + widgets +
// drawer) and reports annotation gaps rather than trusting a checklist.
//
//   node inklet/finkapp/test/aria-audit.mjs [--fail]
//
// Checks:
//   1. every interactive control has an accessible name
//   2. landmarks exist and story text lives in a labelled region
//   3. dynamic content is announced (live regions for story, status)
//   4. aria-* references point at elements that exist
//   5. iframes are titled; decorative images are hidden, real ones alt'd
//   6. no positive tabindex; focusable things are reachable
//   7. state is exposed, not just painted (pressed/expanded/current)

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8177;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CORS = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', ${PORT}),
    functools.partial(H, directory='${serveRoot}')).serve_forever()
`;
const server = spawn('python3', ['-c', CORS], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

const findings = [];
const note = (sev, msg) => findings.push({ sev, msg });

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 860 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&story=/${repoName}/inklet/demos/foafos-tour.fink.js`);
  await page.waitForFunction(() => document.querySelectorAll('#choices .choice-btn').length > 0, null, { timeout: 25000 });
  await page.waitForTimeout(800);

  // FIRST, while the story owns the screen: does a new beat announce?
  // (with a game running there are no choices to click)
  // EVENTS: do dynamic changes get announced? Drive the app and watch
  // for live-region content, not just its presence.
  const announced = await page.evaluate(async () => {
    const seen = [];
    const live = [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')];
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        const host = m.target.closest?.('[aria-live], [role="status"], [role="alert"], [role="log"]');
        if (host) seen.push((host.textContent || '').trim().slice(0, 40));
      }
    });
    for (const l of live) obs.observe(l, { childList: true, subtree: true, characterData: true });
    // advance the story: a new beat is the most important announcement
    document.querySelector('#choices .choice-btn')?.click();
    await new Promise(r => setTimeout(r, 1200));
    obs.disconnect();
    return { liveRegions: live.length, changes: seen.length, sample: seen.slice(0, 2) };
  });
  if (announced.changes === 0) {
    note('error', `advancing the story produced NO live-region update (${announced.liveRegions} live regions exist)`);
  }


  // open every surface so the audit sees the whole platform: a running
  // game (WM chrome + pad + guest), a widget window, and the drawer
  await page.evaluate(() => {
    FinkInkEngine.story.ChoosePathString('game');
    FinkInkEngine.continueStory();
  });
  await page.waitForSelector('#minigame-iframe-robbin', { timeout: 20000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    FinkMinigames.currentControls = 'dpad';
    FoafOS.refreshPad();
    FoafOS.openWidget('tally');
    // the new OS surfaces: the app grid and the running-apps switcher
    FoafOS.openHome();
    FoafOS.openSwitcher();
    FinkWM._setCollapsed(false);
    document.getElementById('foafos-dock').click();
  });
  await page.waitForTimeout(900);

  const AUDIT = () => {
    const out = [];
    const name = (el) => {
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const lb = el.getAttribute('aria-labelledby');
      if (lb) return lb.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
      if (el.tagName === 'INPUT' && el.labels?.length) return [...el.labels].map(l => l.textContent).join(' ').trim();
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
      return (el.getAttribute('title') || '').trim();
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };

    // 1. interactive controls need names
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]')) {
      if (!visible(el)) continue;
      if (el.hasAttribute('aria-hidden')) continue;
      if (!name(el)) out.push({ sev: 'error', msg: `unnamed control: <${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} class="${el.className}">` });
      const ti = el.getAttribute('tabindex');
      if (ti && Number(ti) > 0) out.push({ sev: 'warn', msg: `positive tabindex on ${el.id || el.tagName}` });
    }

    // 2. landmarks + the story region
    if (!document.querySelector('main, [role="main"]')) out.push({ sev: 'error', msg: 'no main landmark' });
    const story = document.getElementById('story-output');
    if (story) {
      const region = story.closest('[role="region"], [role="log"], main, article, section');
      if (!region) out.push({ sev: 'warn', msg: 'story output is not inside a labelled region' });
      const live = story.getAttribute('aria-live') || story.closest('[aria-live]')?.getAttribute('aria-live');
      if (!live) out.push({ sev: 'error', msg: 'story text is NOT in a live region — new prose is never announced' });
    }

    // 3. status/loading announcements
    const status = document.getElementById('status');
    if (status && !status.getAttribute('role') && !status.getAttribute('aria-live')) {
      out.push({ sev: 'error', msg: 'status element has no role=status / aria-live' });
    }

    // 4. dangling aria references
    for (const el of document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns]')) {
      for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns']) {
        const v = el.getAttribute(attr);
        if (!v) continue;
        for (const id of v.split(/\s+/)) {
          if (id && !document.getElementById(id)) out.push({ sev: 'error', msg: `${attr}="${id}" points at a missing element (on ${el.id || el.tagName})` });
        }
      }
    }

    // 5. frames and images
    for (const f of document.querySelectorAll('iframe')) {
      if (!f.getAttribute('title')) out.push({ sev: 'error', msg: `iframe without title: ${f.id || f.src.slice(0, 60)}` });
    }
    for (const img of document.querySelectorAll('img')) {
      if (!visible(img)) continue;
      if (img.getAttribute('alt') === null && !img.hasAttribute('aria-hidden')) {
        out.push({ sev: 'error', msg: `img with no alt and not aria-hidden: ${(img.src || '').slice(-40)}` });
      }
    }

    // 6. state exposure on things that look toggled
    for (const el of document.querySelectorAll('.active, [class*="selected"], [class*="pressed"]')) {
      if (!visible(el) || el.tagName !== 'BUTTON') continue;
      const has = el.hasAttribute('aria-pressed') || el.hasAttribute('aria-expanded')
        || el.hasAttribute('aria-current') || el.hasAttribute('aria-selected');
      if (!has) out.push({ sev: 'warn', msg: `visually active button exposes no ARIA state: ${el.id || name(el).slice(0, 24)}` });
    }

    // 7. custom elements that own semantics
    const feed = document.querySelector('foafos-feed [role="feed"], foafos-feed > div');
    if (feed && feed.getAttribute('role') !== 'feed') out.push({ sev: 'warn', msg: 'feed container missing role=feed' });

    // 8. duplicate ids silently break every aria-*by reference
    const ids = new Map();
    for (const el of document.querySelectorAll('[id]')) ids.set(el.id, (ids.get(el.id) || 0) + 1);
    for (const [id, n] of ids) if (n > 1) out.push({ sev: 'error', msg: `duplicate id "${id}" (${n}×) — breaks aria references` });

    // 9. roles must be real ones
    const VALID = new Set(['alert','alertdialog','application','article','banner','button','cell','checkbox',
      'columnheader','combobox','complementary','contentinfo','definition','dialog','directory','document','feed',
      'figure','form','grid','gridcell','group','heading','img','link','list','listbox','listitem','log','main',
      'marquee','math','menu','menubar','menuitem','menuitemcheckbox','menuitemradio','navigation','none','note',
      'option','presentation','progressbar','radio','radiogroup','region','row','rowgroup','rowheader','scrollbar',
      'search','searchbox','separator','slider','spinbutton','status','switch','tab','table','tablist','tabpanel',
      'term','textbox','timer','toolbar','tooltip','tree','treegrid','treeitem']);
    for (const el of document.querySelectorAll('[role]')) {
      for (const r of el.getAttribute('role').split(/\s+/)) {
        if (r && !VALID.has(r)) out.push({ sev: 'error', msg: `invalid role="${r}" on ${el.id || el.tagName}` });
      }
    }

    // 10. a labelled region needs a label; role=region without one is noise
    for (const el of document.querySelectorAll('[role="region"], [role="group"], [role="toolbar"], [role="feed"], [role="application"], [role="tree"]')) {
      if (!visible(el)) continue;
      if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
        out.push({ sev: 'warn', msg: `role="${el.getAttribute('role')}" with no accessible name (${el.id || el.className})` });
      }
    }

    // 11. heading order shouldn't skip levels
    let prev = 0;
    for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      if (!visible(h)) continue;
      const lvl = Number(h.tagName[1]);
      if (prev && lvl > prev + 1) out.push({ sev: 'warn', msg: `heading jumps h${prev}→h${lvl} ("${h.textContent.trim().slice(0, 24)}")` });
      prev = lvl;
    }

    return out;
  };

  for (const f of await page.evaluate(AUDIT)) note(f.sev, f.msg);

  // 9. PLATFORM EVENTS must reach the announcer, not just the screen
  const events = await page.evaluate(async () => {
    const el = document.getElementById('foafos-announcer');
    if (!el) return { missing: true };
    const heard = [];
    const obs = new MutationObserver(() => {
      const t = (el.textContent || '').trim();
      if (t) heard.push(t);
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    const wait = () => new Promise(r => setTimeout(r, 260));
    FoafOS.setSkin('terminal'); await wait();
    FoafOS.bus.publish('wm.mode', { mode: 'pip' }); await wait();
    FoafOS.bus.publish('minigame.start', { type: 'gems', summary: 'Gem Hunt started' }); await wait();
    FoafOS.bus.publish('sys.guest.denied', { guest: 'x', topic: 'session.hijack' }); await wait();
    FoafOS.setSkin('spectrum'); await wait();
    obs.disconnect();
    return { heard };
  });
  if (events.missing) note('error', 'no #foafos-announcer — platform events are silent to assistive tech');
  else {
    const want = [/skin/i, /pip/i, /gem hunt/i, /blocked/i];
    const missed = want.filter(rx => !events.heard.some(h => rx.test(h)));
    if (missed.length) note('error', `announcer missed ${missed.length} event class(es); heard: ${JSON.stringify(events.heard)}`);
  }

  // 10. THE READING SURFACE ITSELF, plus our own guest widgets.
  //
  // The storyrunner is in this list because the audit went BLIND when the
  // story moved into the box: everything above walks the top document, and
  // once the reading happens in a sandboxed frame the walk finds an empty
  // room and reports zero errors. That is the worst kind of green. The
  // reading surface is the one surface a non-visual reader spends all their
  // time in, so it is checked harder than a widget — names, and whether the
  // beat is addressable at all.
  for (const frame of page.frames()) {
    if (!/tally|robbin|guest\.html/.test(frame.url())) continue;
    const gaps = await frame.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('button, a[href], input')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const n = (el.getAttribute('aria-label') || el.textContent || el.title || '').trim();
        if (!n) bad.push(el.id || el.tagName);
      }
      for (const c of document.querySelectorAll('canvas')) {
        if (!c.getAttribute('aria-label') && !c.hasAttribute('aria-hidden') && !c.getAttribute('role')) {
          bad.push('unlabelled canvas');
        }
      }
      return bad;
    }).catch(() => []);
    for (const g of gaps) note('warn', `guest ${frame.url().split('/').pop()}: unnamed ${g}`);
  }

  // ── 11. THE READING SURFACE, WHERE THE READING ACTUALLY HAPPENS ─────────
  //
  // Everything above walks the top document of a `?player=legacy` page. When
  // the story moved into the box that walk started finding an EMPTY ROOM and
  // reporting zero errors — the worst kind of green, and it lasted until the
  // accessibility tree was dumped by hand. So the boxed surface gets its own
  // visit, and it is checked harder than a widget: it is the one surface a
  // non-visual reader spends all their time in.
  {
    const bp = await ctx.newPage();
    await bp.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=boxed`);
    await bp.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
    let rf = null;
    for (let i = 0; i < 50 && !rf; i++) {
      rf = bp.frames().find((f) => f.url().includes('apps/storyrunner'));
      if (!rf) await bp.waitForTimeout(300);
    }
    if (!rf) note('error', 'the reading surface never appeared to audit');
    else {
      await rf.waitForFunction(
        () => window.__storyrunner?.ready?.() && window.__storyrunner.state.choices.length > 0,
        null, { timeout: 25000 }).catch(() => {});
      // TAKE A CHOICE FIRST. Focus management is only observable after a beat
      // the READER caused; on first paint the document body is a fair place
      // for the keyboard to be.
      await rf.evaluate(() => window.__storyrunner.choose(0)).catch(() => {});
      await bp.waitForTimeout(2200);
      // THE BROWSER SURFACE IS AN API (owner, 2026-07-30). A non-visual reader
    // and an agent drive the same accessibility tree, so these are contract
    // checks, not polish: can you NAME where you are, READ what was said, and
    // FIND what you may do next — without seeing anything.
    const surface = await rf.evaluate(() => {
      const nameOf = (el) => !el ? null
        : (el.getAttribute('aria-label')
           || (el.getAttribute('aria-labelledby')
               && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent)
           || null);
      const main = document.querySelector('main');
      const log = document.querySelector('[role="log"]');
      const list = document.querySelector('#choices');
      return {
        mainNamed: !!nameOf(main),
        logNamed: !!nameOf(log),
        logLive: log?.getAttribute('aria-live') || null,
        choicesNamed: !!nameOf(list),
        choices: [...document.querySelectorAll('#choices button')].map((b) => b.textContent.trim()).filter(Boolean).length,
        heading: !!document.querySelector('h1, [role="heading"]'),
        // Where is the keyboard after a beat has rendered? `body` means a
        // reader who takes a choice is dropped back at the top of the
        // document every time.
        focus: document.activeElement === document.body ? 'body'
             : (document.activeElement?.id || document.activeElement?.tagName || 'none'),
        // Media named by its FILE PATH is not a name.
        pathAlts: [...document.querySelectorAll('img')]
          .map((i) => i.getAttribute('alt') || '')
          .filter((a) => /\.(png|jpe?g|svg|webp|gif)$/i.test(a) || a.includes('/')).length,
      };
    }).catch(() => null);
    if (!surface) note('error', 'reading surface: could not be inspected at all');
    else {
    if (!surface.mainNamed) note('error', 'reading surface: the story region has no accessible name — "main" is anonymous');
    if (!surface.heading) note('error', 'reading surface: no heading, so there is no way to jump to the story');
    if (surface.logLive !== 'polite') note('error', `reading surface: prose is not a polite live region (aria-live=${surface.logLive})`);
    if (!surface.choicesNamed) note('error', 'reading surface: the choice list has no accessible name');
    if (!surface.choices) note('error', 'reading surface: no named choices to act on');
    if (surface.pathAlts) note('error', `reading surface: ${surface.pathAlts} image(s) named by file path, which is not a name`);
    if (surface.focus === 'body') note('error', 'reading surface: focus does not follow the reading — after a beat the keyboard is back at the document body');
    }
    }

    // A GLYPH IS NOT A NAME. Check 1 above asks whether a control has a
    // non-empty accessible name, and "☰" and "▶" pass it while telling a
    // non-visual reader — or an agent — nothing at all. So: a name with no
    // letters in it is not a name. Emoji may DECORATE a name ("🔊 Mute"); they
    // may not BE one.
    const glyphOnly = await bp.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a[href], summary, [role="button"]')) {
        if (el.offsetParent === null) continue;
        // REAL accname precedence: aria-label, then aria-labelledby, then the
        // element's own text, and `title` only as a LAST resort. Getting this
        // backwards is why the first version of this check passed: it read the
        // helpful `title="Show navigation path"` and never noticed that the
        // browser names the button "▶", because text content outranks title.
        const labelled = el.getAttribute('aria-labelledby');
        const name = (el.getAttribute('aria-label')
          || (labelled && document.getElementById(labelled)?.textContent)
          || el.textContent
          || el.title || '').trim();
        if (!name) { out.push(`${el.id || el.tagName}: no name at all`); continue; }
        // Any letter in any script counts. Digits alone do not name a control.
        if (!/\p{L}/u.test(name)) out.push(`${el.id || el.tagName}: named "${name}"`);
      }
      return out;
    }).catch(() => []);
    for (const g of glyphOnly) note('error', `shell control named by a glyph, not a word — ${g}`);

    await bp.close();
  }

} catch (e) {
  note('error', `audit crashed: ${String(e).slice(0, 200)}`);
} finally {
  await browser?.close();
  server.kill();
}

const errors = findings.filter(f => f.sev === 'error');
const warns = findings.filter(f => f.sev === 'warn');
for (const f of findings) console.log(`${f.sev === 'error' ? '✖' : '⚠'} ${f.msg}`);
console.log(`\nARIA AUDIT: ${errors.length} error(s), ${warns.length} warning(s)`);
if (process.argv.includes('--fail') && errors.length) process.exit(1);
