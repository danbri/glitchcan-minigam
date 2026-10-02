// Larkspur Falls as a graphic-novel page (cozyverse/larkspur/novel/festival.html) on a phone-sized touch screen:
// the start screen, a voice take for each "# voice:" tag, the view following the story, every media file loading,
// and both loops playing.   node inklet/finkapp/test/e2e-larkspur-novel.mjs   (SHOTS=dir saves screenshots)
import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const PORT = 8178;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL0 = `http://127.0.0.1:${PORT}/${basename(repoRoot)}/cozyverse/larkspur/novel/festival.html`;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', join(repoRoot, '..')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
let failed = 0;
const fail = (m) => { failed++; console.error('✖', m); };
const pass = (m) => console.log('✔', m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], missing = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
  await page.goto(URL0);
  await page.waitForSelector('#go-sound');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/0-start.png` });
  await page.click('#go-sound');
  const voiced = [];
  const step = async (label, knot, voice) => {
    if (label) {
      await page.waitForFunction((t) => [...document.querySelectorAll('.ink .choice')].some((b) => b.textContent === t), label, { timeout: 15000 });
      await page.evaluate((t) => [...document.querySelectorAll('.ink .choice')].find((b) => b.textContent === t).click(), label);
    }
    await page.waitForFunction((v) => (window.__festival.playing || '').includes(`/vo/${v}-`), voice, { timeout: 15000 })
      .then(() => voiced.push(voice)).catch(() => fail(`no "${voice}" take playing after "${label || 'start'}"`));
    await wait(1600);
    const cur = await page.evaluate(() => { const p = document.getElementById('page'); return p.current < 0 ? 'page' : p.panels[p.current].getAttribute('knot'); });
    cur === knot ? pass(`"${label || 'Begin, with sound'}": view on ${knot}, voice "${voice}" plays`) : fail(`after "${label}": view on ${cur}, not ${knot}`);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${voiced.length}-${knot}.png` });
  };
  await step(null, 'page', 'page');
  await step('Step up to the microphone', 'crowd', 'mayor');
  await step('Find Agatha Pruitt in the crowd', 'agatha', 'box');
  await step('Look into the box', 'box', 'snowing');
  await step('Look at the edge of the crowd', 'wreath', 'wreath');
  await step('Find Agatha Pruitt in the crowd', 'agatha', 'box');
  await step('Name Agatha Pruitt', 'box', 'confess');
  const vids = await page.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ src: v.currentSrc.split('/').pop(), t: v.currentTime, ready: v.readyState })));
  vids.every((v) => v.ready >= 2) ? pass(`both loops loaded: ${vids.map((v) => v.src).join(', ')}`) : fail(`loops: ${JSON.stringify(vids)}`);
  const small = await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].filter((b) => b.getBoundingClientRect().height < 44).length);
  small ? fail(`${small} choice buttons under 44 px`) : pass('choice buttons are at least 44 px tall');
  missing.length ? fail(`missing files: ${missing.join(', ')}`) : pass('no missing files');
  errors.length ? fail('page errors: ' + errors.join(' | ')) : pass('no page errors');
} finally { await browser.close(); server.kill(); }
console.log(failed ? '\nLARKSPUR NOVEL: FAIL' : '\nLARKSPUR NOVEL: PASS');
process.exit(failed ? 1 : 0);
