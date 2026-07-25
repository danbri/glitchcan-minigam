// Does each game RESPOND — not just boot?
//
// sweep-minigames.mjs proves the corpus loads: boot, ready, drew, grants,
// focusable, live region, labelled canvas. All structural. None of it
// distinguishes a game from a screenshot of a game.
//
// The hard part is that most of these animate on their own, so "the
// pixels changed after I pressed a key" proves nothing whatsoever. The
// method here is a differential: measure the same interval TWICE, once
// idle and once while driving input, and compare. A game that responds
// changes more (or differently) under input than it does when left
// alone. A game that ignores input looks identical in both windows.
//
// Where a game exposes a state hook (__robbin, __gridluck, __boidwars)
// that is used instead — an exact answer beats a statistical one — and
// the report says which method produced each verdict, so a weak result
// reads as weak rather than hiding inside a uniform table.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const repoName = basename(repoRoot);
const PORT = 8151;
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

// Per-game: how to read its state, and how it is actually PLAYED.
//
// Driving everything with arrow keys was the first version's mistake:
// battleboids has a single keydown handler (splash start, and R to
// restart) because it is aimed with a pointer. "No response to the
// arrows" was a true statement about an irrelevant input. A game must be
// probed the way a person plays it or the verdict is meaningless.
//
// `hook` runs inside whichever frame holds the game. `drive` gets the
// host page and the game's own bounding box.
const keys = (...ks) => async (page, box, i) => {
  const k = ks[i % ks.length];
  await page.keyboard.down(k); await page.waitForTimeout(40); await page.keyboard.up(k);
};
// aim-and-release, the wizard duel's actual gesture
const drag = async (page, box, i) => {
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.7;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + (i % 2 ? 60 : -60), cy - 40 - (i % 3) * 15, { steps: 4 });
  await page.mouse.up();
};
const taps = async (page, box, i) => {
  await page.mouse.click(box.x + box.width * (0.2 + 0.15 * (i % 5)),
                         box.y + box.height * (0.25 + 0.12 * (i % 4)));
};

const GAMES = [
  { id: 'robbin', frame: /magpie\/robbin\/robbin\.html/,
    // cam is an ARRAY [x,y] — reading .x got undefined and silently
    // pinned the sample to a constant, which read as "no response".
    hook: () => { const t = window.__robbin?.game?.tube;
                  return t && `${t.cur}|${t.cam?.map(Math.round).join(',')}`; },
    drive: keys('ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown') },
  { id: 'gridluck', frame: /thumbwar\/gridluck\.html/,
    hook: () => { const g = window.__gridluck?.game; return g && `${g.ply?.next}|${g.score}`; },
    drive: keys('ArrowLeft', 'ArrowUp') },
  { id: 'battleboids', frame: /thumbwar\/battleboids\.html/,
    hook: () => { const b = window.__boidwars;
                  return b && `${b.state}|${b.wizards?.[0]?.state}|${b.boids}`; },
    drive: drag },
  // Gated behind its own start overlay, inside a shadow root. A game
  // waiting on a splash is not an unresponsive game — press its button
  // the way a person would, then measure.
  { id: 'mudslider', frame: /minigames\/mudslider/,
    // A one-tile move on a mostly-static board is invisible to a coarse
    // canvas downsample — this read "inconclusive" until the element's
    // own state was used. Exact beats statistical, every time.
    hook: () => { const el = [...document.querySelectorAll('*')]
                    .find(e => e.shadowRoot && e.tagName.startsWith('GC-'));
                  return el?.player && `${el.player.x},${el.player.y}|${el.playerState?.score}`; },
    // it registers window.keydown — a d-pad game, not a tap game
    drive: keys('ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'),
    prime: (target) => target.evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        const b = el.shadowRoot?.getElementById('start-button-minigame');
        if (b) { b.click(); return true; }
      }
      return false;
    }) },
  { id: 'chess',     frame: /minigames\/chess/,     hook: () => null, drive: taps },
  // Inline in the host page, and it spawns and expires gems on a timer,
  // so a whole-DOM fingerprint is pure noise — its own churn drowns the
  // signal. The score counter is the exact answer, and the gems are what
  // a player actually clicks.
  { id: 'gems', frame: null, drive: (page) => page.click('.gem', { timeout: 1200 }).catch(() => {}),
    hook: () => document.querySelector('.gem-count')?.textContent ?? null },
  { id: 'mega', frame: null, drive: (page) => page.click('.gem', { timeout: 1200 }).catch(() => {}),
    hook: () => document.querySelector('.gem-count')?.textContent ?? null },
];

const fail = (m) => { console.error('✖', m); process.exitCode = 1; };
const rows = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
           '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  for (const g of GAMES) {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 860 }, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 90)));
    await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?story=/${repoName}/inklet/hampstead.fink.js`);
    await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
    await page.waitForTimeout(1000);

    const row = { id: g.id, method: '-', idle: '-', driven: '-', verdict: '?', note: '' };
    try {
      await page.evaluate((t) => window.FinkMinigames.startMinigame(t, 'normal'), g.id);
      await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 15000 });
      await page.waitForTimeout(4500);

      const target = g.frame ? page.frames().find(f => g.frame.test(f.url())) : page;
      if (!target) { row.verdict = 'NO FRAME'; rows.push(row); await ctx.close(); continue; }

      // Which yardstick can this game actually be measured with?
      const hookWorks = g.hook && await target.evaluate(g.hook).then(v => v != null).catch(() => false);

      // A canvas is sampled rather than hashed whole: scale it into a
      // small grid and threshold each cell. Cheap, and stable against
      // the CRT scanline shimmer that would make a pixel hash differ on
      // every frame regardless of input.
      //
      // KNOWN LIMIT, and the reason `inconclusive` is a distinct verdict
      // rather than a failure: at this resolution a change smaller than a
      // grid cell — one tile of movement on a big board — is invisible.
      // Any game where that matters needs a state hook, not a bigger
      // grid. 32 is a compromise, not a solution.
      const sample = async () => {
        if (hookWorks) return String(await target.evaluate(g.hook));
        return await target.evaluate(() => {
          // querySelectorAll does not cross a shadow boundary, and
          // mudslider's <canvas> lives inside a web component — so the
          // canvas branch was skipped and a canvas game got fingerprinted
          // by its class names, which of course never change.
          const canvases = [];
          const collect = (root, depth = 0) => {
            if (depth > 4) return;
            for (const el of root.querySelectorAll('*')) {
              if (el.tagName === 'CANVAS') canvases.push(el);
              if (el.shadowRoot) collect(el.shadowRoot, depth + 1);
            }
          };
          collect(document);
          const c = canvases.sort((a, b) => b.width * b.height - a.width * a.height)[0];
          if (c) {
            try {
              const t = document.createElement('canvas');
              t.width = t.height = 32;
              t.getContext('2d').drawImage(c, 0, 0, 32, 32);
              const d = t.getContext('2d').getImageData(0, 0, 32, 32).data;
              let s = '';
              for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2] > 90) ? '1' : '0';
              return s;
            } catch { /* tainted or 0-size */ }
          }
          // No canvas: the DOM is the display (chess, gems) — and it may
          // be inside a shadow root (mudslider is a web component), which
          // document.body.innerHTML cannot see. A sampler blind to the
          // display reports "nothing ever changes" for a working game.
          const walk = (root, depth = 0) => {
            if (depth > 4) return '';
            let s = '';
            for (const el of root.querySelectorAll('*')) {
              if (el.shadowRoot) s += walk(el.shadowRoot, depth + 1);
              else if (el.className && typeof el.className === 'string') s += el.className + ',';
              const t = el.firstChild;
              if (t && t.nodeType === 3 && t.textContent.trim()) s += t.textContent.trim().slice(0, 12);
            }
            return s;
          };
          const s = walk(document);
          return s.length + '|' + s.slice(0, 600);
        });
      };

      if (g.prime) {
        const primed = await g.prime(target).catch(() => false);
        row.note = primed ? 'started via its own splash button' : 'splash button not found';
        await page.waitForTimeout(1500);
      }
      const box = (await (await page.$('#minigame-view')).boundingBox())
        || { x: 0, y: 0, width: 430, height: 860 };
      const churn = async (drive) => {
        const seen = new Set();
        for (let i = 0; i < 12; i++) {
          if (drive) await g.drive(page, box, i);
          await page.waitForTimeout(120);
          seen.add(await sample());
        }
        return seen.size;                 // distinct states seen in the window
      };

      row.method = hookWorks ? 'state hook' : 'canvas/DOM sample';
      row.idle = await churn(false);
      row.driven = await churn(true);
      // A responding game shows strictly more distinct states under
      // input than idle. Equal counts on a hook mean the input did
      // nothing; equal counts on a sample are inconclusive, not a pass.
      if (row.driven > row.idle) row.verdict = 'RESPONDS';
      else if (hookWorks) { row.verdict = 'NO RESPONSE'; fail(`${g.id}: state did not move under input`); }
      else {
        row.verdict = 'inconclusive';
        row.note = (row.note ? row.note + '; ' : '') + 'self-animating, no state hook';
      }
      if (errs.length) { row.note = (row.note ? row.note + '; ' : '') + errs[0]; }
    } catch (e) {
      row.verdict = 'THREW';
      row.note = String(e).split('\n')[0].slice(0, 80);
      fail(`${g.id}: ${row.note}`);
    }
    rows.push(row);
    await ctx.close();
  }

  console.log('\nGAME RESPONSIVENESS — distinct states seen in a 12-sample window\n');
  console.log('game          method              idle  driven  verdict');
  console.log('-'.repeat(70));
  for (const r of rows) {
    console.log(`${r.id.padEnd(13)} ${String(r.method).padEnd(19)} ${String(r.idle).padStart(4)} ${String(r.driven).padStart(7)}  ${r.verdict}`);
  }
  const notes = rows.filter(r => r.note);
  if (notes.length) {
    console.log();
    for (const r of notes) console.log(`  ${r.id}: ${r.note}`);
  }
  console.log(process.exitCode ? '\nGAME QA: FAIL' : '\nGAME QA: PASS');
} catch (e) {
  console.error('fatal:', e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
