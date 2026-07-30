// QA deep-dive: one long user session, audited after every step.
//
// The point-tests each prove one thing about one surface. This proves
// something different: that the WHOLE experience holds together while a
// person moves through it — story, home screen, office window, TV, a
// game, split, pip, back to the story — on a phone, a tablet and a
// desktop, with a keyboard and with a thumb.
//
// The method is a continuous audit, not a list of assertions. After
// EVERY step the same invariants are re-checked against the live page:
//
//   overflow    the page never scrolls sideways
//   offscreen   no visible control sits outside the viewport
//   unnamed     every visible control has an accessible name
//   tiny        every visible control is at least 24px (WCAG 2.5.8)
//   dialog      role=dialog carries aria-modal and holds the focus
//   occluded    nothing covers the on-screen pad while it is up
//   errors      no page errors, no console errors
//
// A defect that only appears in one state — a button that loses its
// label once a game is running, a dialog that drops focus on a phone —
// shows up as the step where an invariant first fails. Screenshots are
// written for every step so the failures can be looked at rather than
// guessed at.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const repoName = basename(repoRoot);
const PORT = 8149;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.env.QA_OUT || '/tmp/qa-journey';
mkdirSync(OUT, { recursive: true });

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

// ── the audit, evaluated inside the page ────────────────────────────────
// Kept as one function so it runs in a single round-trip per step.
const AUDIT = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const named = (el) => {
    const t = (el.getAttribute('aria-label') || '').trim();
    if (t) return true;
    const lb = el.getAttribute('aria-labelledby');
    if (lb && lb.split(/\s+/).some(id => document.getElementById(id)?.textContent.trim())) return true;
    if ((el.getAttribute('title') || '').trim()) return true;
    if ((el.textContent || '').trim()) return true;
    if (el.tagName === 'IMG' && el.hasAttribute('alt')) return true;
    if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true;
    if (el.closest('label')) return true;
    if (el.type === 'range' || el.type === 'text' || el.type === 'password') {
      return !!(el.getAttribute('placeholder') || '').trim();
    }
    return false;
  };
  const label = (el) =>
    `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
    `${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}` +
    `${(el.textContent || '').trim() ? ` "${(el.textContent || '').trim().slice(0, 18)}"` : ''}`;

  // A control only counts if a person can actually reach it. Hidden by
  // `inert` or `aria-hidden` means withdrawn on purpose — that is the
  // correct way to close a panel, and auditing its contents would be
  // noise. Everything else IS reachable, including things the eye
  // cannot see, which is the whole point.
  const controls = [...document.querySelectorAll(
    'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')]
    .filter(el => vis(el) && !el.disabled &&
                  !el.closest('[inert]') && !el.closest('[aria-hidden="true"]'));

  const out = { overflow: [], offscreen: [], unnamed: [], tiny: [], dialog: [], occluded: [] };
  // A whole panel parked off-screen is ONE defect, not one per button.
  const PANELS = '#foafos-drawer, #foafos-home, #foafos-switcher, .foafos-window, [role="dialog"]';
  const strayPanels = new Map();

  // Sideways bleed — the commonest mobile layout defect, and NOT
  // detectable via scrollWidth here: the shell sets `overflow: hidden`,
  // so content wider than the screen is silently CLIPPED rather than
  // made scrollable. scrollWidth never grows, and a check built on it
  // reports clean forever. (The audit's own self-test caught that.) So
  // measure geometry instead: content that crosses the right edge.
  if (document.documentElement.scrollWidth > vw + 1) {
    out.overflow.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px in ${vw}px`);
  }
  const bleeds = (el) => {
    if (!vis(el)) return false;
    if (el.closest('[inert]') || el.closest('[aria-hidden="true"]')) return false;
    const s = getComputedStyle(el);
    if (s.position === 'fixed') return false;          // panels park off-screen on purpose
    // a container that scrolls sideways is MEANT to hold wide content
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return false;
    }
    // only content a person can see or use: a wide empty spacer is not a defect
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const isControl = el.matches('button, a[href], input, select, textarea, [role="button"], img, canvas');
    if (!hasText && !isControl) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 2 || r.left < -2);
  };
  for (const el of [...document.querySelectorAll('body *')].filter(bleeds).slice(0, 6)) {
    const r = el.getBoundingClientRect();
    out.overflow.push(`${label(el)} crosses the edge (${Math.round(r.left)}…${Math.round(r.right)} in ${vw}px)`);
  }

  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) {
      const panel = el.closest(PANELS);
      if (panel) {
        const k = label(panel);
        strayPanels.set(k, (strayPanels.get(k) || 0) + 1);
      } else {
        out.offscreen.push(`${label(el)} at ${Math.round(r.x)},${Math.round(r.y)}`);
      }
    }
    if (!named(el)) out.unnamed.push(label(el));
    // WCAG 2.5.8 target size (minimum) is 24×24 CSS px
    if (r.width < 24 || r.height < 24) {
      out.tiny.push(`${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }

  for (const d of document.querySelectorAll('[role="dialog"]')) {
    if (!vis(d)) continue;
    const name = d.getAttribute('aria-label') || d.getAttribute('aria-labelledby');
    if (d.getAttribute('aria-modal') !== 'true') out.dialog.push(`${label(d)} lacks aria-modal`);
    if (!name) out.dialog.push(`${label(d)} has no accessible name`);
    if (!d.contains(document.activeElement)) {
      out.dialog.push(`${label(d)} does not hold focus (on ${label(document.activeElement || document.body)})`);
    }
  }

  for (const [k, n] of strayPanels) {
    out.offscreen.push(`${k} is off-screen but still focusable (${n} controls in the tab order)`);
  }

  // The pad is the only control on a phone: nothing may cover it. Probe
  // the BUTTONS, not their container — the gap between A and B is
  // legitimately see-through, and probing the container's centre lands
  // in that gap and reports the game underneath as an occlusion.
  //
  // An OPEN shell surface covering the pad is not a defect: you are in
  // the shell, not playing. Only an occlusion with nothing open is one.
  const shellOpen = !!document.querySelector(
    '#foafos-drawer.open, #foafos-home, #foafos-switcher, [role="dialog"]');
  const pad = document.getElementById('foaf-pad');
  if (!shellOpen && pad && !pad.hidden && vis(pad)) {
    for (const t of pad.querySelectorAll('[data-action], .foaf-pad-dir')) {
      const r = t.getBoundingClientRect();
      if (!r.width) continue;
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (top && !pad.contains(top)) {
        out.occluded.push(`pad ${t.dataset.action || 'joystick'} covered by ${label(top)}`);
      }
    }
  }
  return out;
};

// ── the journey ─────────────────────────────────────────────────────────
// Each step is [name, fn]. Steps that do not apply to a viewport return
// the string 'skip' and are recorded as skipped, not as passing.
const journey = (page, W) => [
  ['boot', async () => {
    await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
    await page.waitForTimeout(1200);
  }],
  ['open drawer', async () => {
    await page.click('#foafos-dock');
    await page.waitForTimeout(400);
  }],
  ['home screen', async () => {
    await page.click('#foafos-home-btn');
    await page.waitForTimeout(500);
  }],
  ['launch office app', async () => {
    await page.click('#foafos-home [data-app="sheets"]').catch(async () => {
      await page.evaluate(() => FoafOS.launchApp('sheets'));
    });
    await page.waitForTimeout(1800);
  }],
  ['launch TV', async () => {
    await page.evaluate(() => FoafOS.openHome());
    await page.waitForTimeout(300);
    await page.click('#foafos-home [data-app="channels"]').catch(async () => {
      await page.evaluate(() => FoafOS.launchApp('channels'));
    });
    await page.waitForTimeout(1800);
  }],
  ['switcher (Alt+Tab)', async () => {
    await page.keyboard.press('Alt+Tab');
    await page.waitForTimeout(500);
  }],
  ['mute everything', async () => {
    await page.keyboard.press('Escape');        // dismiss the switcher
    await page.waitForTimeout(250);
    // Escape closes the drawer too, so re-open it before reaching for a
    // control inside it. (A person would see it shut; the test must not
    // pretend otherwise.)
    await page.evaluate(() => {
      const d = document.getElementById('foafos-drawer');
      if (!d.classList.contains('open')) document.getElementById('foafos-dock').click();
    });
    await page.waitForTimeout(350);
    await page.click('#foafos-mute', { timeout: 5000 });
    await page.waitForTimeout(300);
  }],
  ['volume down', async () => {
    await page.evaluate(() => {
      const v = document.getElementById('foafos-vol');
      v.value = '35'; v.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
  }],
  ['maker panel', async () => {
    await page.evaluate(() => FoafOS.openMaker());
    await page.waitForTimeout(700);
  }],
  ['close app windows', async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.foafos-window .foafos-window-close').forEach(b => b.click());
    });
    await page.waitForTimeout(600);
  }],
  ['start a game', async () => {
    await page.evaluate(() => FinkMinigames.startMinigame('robbin', 'normal'));
    await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 15000 });
    await page.waitForTimeout(4000);
  }],
  ['play it', async () => {
    const f = page.frames().find(x => x.url().includes('magpie/robbin/robbin.html'));
    if (!f) return 'skip';
    const pad = await page.$('#foaf-pad .foaf-pad-dir');
    const b = pad && await pad.boundingBox();
    if (!b) return 'skip';                      // no pad on a mouse device
    await page.mouse.move(b.x + b.width * 0.1, b.y + b.height / 2);
    await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
    await page.waitForTimeout(200);
  }],
  ['split', async () => {
    await page.evaluate(() => { FinkWM._setCollapsed(false); });
    await page.click('#wm-split', { force: true });
    await page.waitForTimeout(900);
  }],
  ['pip', async () => {
    await page.evaluate(() => { FinkWM._setCollapsed(false); });
    await page.click('#wm-pip', { force: true });
    await page.waitForTimeout(900);
  }],
  ['back to full', async () => {
    await page.evaluate(() => { FinkWM._setCollapsed(false); FinkWM.setMode('full'); });
    await page.waitForTimeout(700);
  }],
  ['pause', async () => {
    await page.evaluate(() => { FinkWM._setCollapsed(false); });
    await page.click('#minigame-pause', { force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }],
  ['resume', async () => {
    await page.click('#minigame-pause', { force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }],
  ['quit the game', async () => {
    await page.evaluate(() => FinkWM.close?.() ?? FinkMinigames.closeMinigame?.());
    await page.waitForTimeout(900);
  }],
  ['story again', async () => {
    await page.evaluate(() => document.getElementById('narrative-view')?.scrollTo(0, 0));
    await page.waitForTimeout(400);
  }],
  ['skin: aurora', async () => {
    await page.evaluate(() => FoafOS.setSkin('aurora'));
    await page.waitForTimeout(400);
  }],
  ['skin: terminal', async () => {
    await page.evaluate(() => FoafOS.setSkin('terminal'));
    await page.waitForTimeout(400);
  }],
];

const VIEWPORTS = [
  { name: 'phone',   width: 390, height: 844,  touch: true },
  { name: 'tablet',  width: 820, height: 1180, touch: true },
  { name: 'desktop', width: 1440, height: 900, touch: false },
];

const KEYS = ['overflow', 'offscreen', 'unnamed', 'tiny', 'dialog', 'occluded'];

// ── negative control ────────────────────────────────────────────────────
// "0 findings" is only worth reading if the audit can still find things.
// Plant one known fault of each kind, confirm every one is caught, then
// remove them. An audit that silently stops working reports a clean bill
// of health forever, which is worse than no audit at all.
async function selfTest(page) {
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__qa_bait';
    d.innerHTML = `
      <button style="position:fixed;left:-400px;top:10px;width:60px;height:40px">off</button>
      <button style="width:10px;height:10px"></button>
      <div role="dialog" style="position:fixed;left:10px;top:10px;width:50px;height:50px">d</div>
      <p style="width:400vw;margin:0">a line of text far wider than the screen</p>`;
    document.body.appendChild(d);
  });
  const a = await page.evaluate(AUDIT);
  await page.evaluate(() => document.getElementById('__qa_bait')?.remove());
  const missed = [
    a.offscreen.length ? null : 'offscreen',
    a.unnamed.length ? null : 'unnamed',
    a.tiny.length ? null : 'tiny',
    a.dialog.length ? null : 'dialog',
    a.overflow.length ? null : 'overflow',
  ].filter(Boolean);
  return missed;
}
const findings = [];     // {viewport, step, kind, detail}
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
           '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch,
    });
    const page = await ctx.newPage();
    const pageErrors = [], consoleErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).split('\n')[0].slice(0, 150)));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      // a dev server 404 for an optional asset is not an app defect
      if (/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(t)) return;
      consoleErrors.push(t.slice(0, 150));
    });
    await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&story=/${repoName}/inklet/hampstead.fink.js`);

    console.log(`\n━━ ${vp.name} ${vp.width}×${vp.height} ${vp.touch ? '(touch)' : '(mouse)'} ━━`);
    await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
    const missed = await selfTest(page);
    missed.length
      ? (console.log(`  ‼ AUDIT IS BLIND to: ${missed.join(', ')} — findings below are not trustworthy`),
         process.exitCode = 1)
      : console.log('  · audit self-test: catches planted overflow/offscreen/unnamed/tiny/dialog');

    const steps = journey(page, vp.width);
    for (const [i, [name, fn]] of steps.entries()) {
      let skipped = false, threw = null;
      try { skipped = (await fn()) === 'skip'; }
      catch (e) { threw = String(e).split('\n')[0].slice(0, 110); }

      const before = pageErrors.length + consoleErrors.length;
      const a = await page.evaluate(AUDIT).catch(e => ({ _err: String(e).slice(0, 90) }));
      const tag = `${String(i).padStart(2, '0')}-${name.replace(/\W+/g, '-')}`;
      await page.screenshot({ path: join(OUT, `${vp.name}-${tag}.png`) }).catch(() => {});

      const counts = [];
      if (a._err) counts.push(`AUDIT ERROR ${a._err}`);
      for (const k of KEYS) {
        for (const d of (a[k] || [])) findings.push({ viewport: vp.name, step: name, kind: k, detail: d });
        if (a[k]?.length) counts.push(`${k} ${a[k].length}`);
      }
      const newErrs = pageErrors.length + consoleErrors.length - before;
      if (newErrs > 0) counts.push(`errors ${newErrs}`);
      if (threw) counts.push(`STEP THREW: ${threw}`);
      console.log(`  ${skipped ? '·' : threw ? '✖' : '✔'} ${name.padEnd(20)} ${counts.join('  ') || 'clean'}`);
      if (threw) findings.push({ viewport: vp.name, step: name, kind: 'threw', detail: threw });
    }
    for (const e of pageErrors) findings.push({ viewport: vp.name, step: '(any)', kind: 'pageerror', detail: e });
    for (const e of consoleErrors) findings.push({ viewport: vp.name, step: '(any)', kind: 'console', detail: e });
    await ctx.close();
  }

  // ── report ────────────────────────────────────────────────────────────
  // Group by (kind, detail): the same defect at 20 steps is ONE defect,
  // and a report that lists it 20 times hides the other nineteen.
  const grouped = new Map();
  for (const f of findings) {
    const key = `${f.kind} ${f.detail}`;
    const g = grouped.get(key) || { ...f, viewports: new Set(), steps: new Set(), n: 0 };
    g.viewports.add(f.viewport); g.steps.add(f.step); g.n++;
    grouped.set(key, g);
  }
  const rows = [...grouped.values()].sort((a, b) =>
    KEYS.concat(['threw', 'pageerror', 'console']).indexOf(a.kind) -
    KEYS.concat(['threw', 'pageerror', 'console']).indexOf(b.kind) || b.n - a.n);

  console.log(`\n━━ ${rows.length} distinct findings (${findings.length} occurrences) ━━`);
  for (const r of rows) {
    const where = r.viewports.size === 3 ? 'all' : [...r.viewports].join('+');
    const when = r.steps.size > 3 ? `${r.steps.size} steps` : [...r.steps].join(', ');
    console.log(`  [${r.kind}] ${r.detail}`);
    console.log(`      ${where} · ${when} · ${r.n}×`);
  }
  writeFileSync(join(OUT, 'findings.json'),
    JSON.stringify(rows.map(r => ({ ...r, viewports: [...r.viewports], steps: [...r.steps] })), null, 1));
  console.log(`\nscreenshots + findings.json in ${OUT}`);
} catch (e) {
  console.error('fatal:', e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
