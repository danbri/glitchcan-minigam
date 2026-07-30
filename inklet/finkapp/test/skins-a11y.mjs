#!/usr/bin/env node
// Every skin is held to the same accessibility bar. A skin that looks
// good and fails this is a bug, not a taste.
//
//   node inklet/finkapp/test/skins-a11y.mjs
//
// Checks, per skin, on a real rendered story:
//   · body text vs its background            ≥ 4.5:1 (WCAG AA)
//   · choice text vs choice background       ≥ 4.5:1
//   · choice text vs HOVER background        ≥ 4.5:1  (hover must not
//     become the unreadable state — a classic skin regression)
//   · focus ring is visible and not colour-only
//   · every choice is a 44px+ hit target
//   · no horizontal overflow at phone width

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8172;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SKINS = ['spectrum', 'paper', 'terminal', 'aurora', 'broadsheet', 'calm'];

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', serveRoot], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

let fail = 0;
const ok = (n, c, extra = '') => { console.log(`${c ? '✔' : '✖'} ${n}${extra ? '  ' + extra : ''}`); if (!c) fail++; };

// WCAG relative luminance + contrast, composited over a known backdrop
const CONTRAST = `
function parse(c) {
  const m = c.match(/rgba?\\(([^)]+)\\)/);
  if (!m) return [0, 0, 0, 1];
  const p = m[1].split(',').map(s => parseFloat(s));
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}
function over(fg, bg) {           // composite fg (with alpha) onto bg
  const a = fg[3];
  return [0,1,2].map(i => fg[i] * a + bg[i] * (1 - a)).concat(1);
}
function lum(c) {
  const s = c.slice(0,3).map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
  return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2];
}
// Composite a whole backdrop stack, root-most first. Translucent
// scene/choice surfaces must be layered in order — treating one as an
// opaque backdrop reported white-on-white for the glassy skin.
function stack(colors) {
  let acc = parse(colors[0]);
  for (const c of colors.slice(1)) acc = over(parse(c), acc);
  return acc;
}
function contrastOn(fgc, backdrop) {
  const fg = over(parse(fgc), backdrop);
  const a = lum(fg), b = lum(backdrop);
  return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
}
`;

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });

  for (const skin of SKINS) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&skin=${skin}&story=/${repoName}/inklet/demos/foafos-tour.fink.js`);
    await page.waitForFunction(() => document.querySelectorAll('#choices .choice-btn').length > 0, null, { timeout: 25000 });
    await page.waitForTimeout(700);

    const r = await page.evaluate(`(() => {
      ${CONTRAST}
      const pageBg = getComputedStyle(document.body).backgroundColor;
      const text = document.querySelector('#story-output p') || document.querySelector('#story-output');
      const tcs = getComputedStyle(text);
      const scene = text.closest('.story-section') || document.body;
      const sceneBg = getComputedStyle(scene).backgroundColor;

      const btn = document.querySelector('#choices .choice-btn');
      // getComputedStyle is LIVE: snapshot the resting state before we
      // focus the button, or we measure the focus styles by accident.
      const bcs = getComputedStyle(btn);
      const restColor = bcs.color, restBg = bcs.backgroundColor;
      const textColor = tcs.color;
      const rect = btn.getBoundingClientRect();

      // hover state, read from the stylesheet rather than simulated
      let hoverBg = null, hoverInk = null;
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch { continue; }
        for (const rule of rules || []) {
          if (rule.selectorText && /\\.choice-btn:hover/.test(rule.selectorText)) {
            hoverBg = rule.style.backgroundColor || hoverBg;
            hoverInk = rule.style.color || hoverInk;
          }
        }
      }
      const probe = document.createElement('span');
      document.body.appendChild(probe);
      const resolve = (v) => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
      const hb = hoverBg ? resolve(hoverBg) : null, hi = hoverInk ? resolve(hoverInk) : null;
      probe.remove();

      btn.focus();
      const fcs = getComputedStyle(btn, null);
      const sceneStack = stack([pageBg, sceneBg]);
      const choiceStack = stack([pageBg, sceneBg, restBg]);
      return {
        skin: document.documentElement.dataset.skin,
        bodyRatio: contrastOn(textColor, sceneStack),
        choiceRatio: contrastOn(restColor, choiceStack),
        hoverRatio: (hb && hi) ? contrastOn(hi, stack([pageBg, sceneBg, hb])) : null,
        focusWidth: parseFloat(fcs.outlineWidth) || 0,
        focusStyle: fcs.outlineStyle,
        hit: Math.round(rect.height),
        hOver: document.documentElement.scrollWidth - window.innerWidth,
        font: tcs.fontFamily.split(',')[0].replace(/"/g, ''),
      };
    })()`);

    const two = (n) => n == null ? 'n/a' : n.toFixed(2);
    ok(`${skin}: body text contrast`, r.bodyRatio >= 4.5, `${two(r.bodyRatio)}:1 · ${r.font}`);
    ok(`${skin}: choice contrast`, r.choiceRatio >= 4.5, `${two(r.choiceRatio)}:1`);
    ok(`${skin}: hover contrast`, r.hoverRatio == null || r.hoverRatio >= 4.5, `${two(r.hoverRatio)}:1`);
    ok(`${skin}: visible focus ring`, r.focusWidth >= 2 && r.focusStyle !== 'none', `${r.focusWidth}px ${r.focusStyle}`);
    ok(`${skin}: 44px+ hit target`, r.hit >= 44, `${r.hit}px`);
    ok(`${skin}: no sideways overflow`, r.hOver <= 0, `${r.hOver}px`);
    ok(`${skin}: no page errors`, errs.length === 0, errs.slice(0, 1).join(''));
    await page.close();
  }
} catch (e) {
  ok(`fatal: ${String(e).slice(0, 200)}`, false);
} finally {
  await browser?.close();
  server.kill();
}
console.log(fail ? `\nSKIN A11Y: ${fail} FAILED` : '\nSKIN A11Y: all skins pass');
process.exit(fail ? 1 : 0);
