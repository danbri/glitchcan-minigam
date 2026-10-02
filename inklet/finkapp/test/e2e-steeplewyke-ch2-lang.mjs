// Steeple Wyke, chapter 2, with Italian subtitles (cozyverse/steeplewyke/ch2/index.html?lang=it): the start screen and
// the story in Italian over the English voices (the voices are English in every language), and the subtitle choice
// on the start screen. That a translation behaves like the English story is checked offline:
//   node cozyverse/steeplewyke/tools/lang-check.mjs it
//   node inklet/finkapp/test/e2e-steeplewyke-ch2-lang.mjs
import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const PORT = 8183;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}/${basename(repoRoot)}/cozyverse/steeplewyke/ch2/`;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', join(repoRoot, '..')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
let failed = 0;
const fail = (m) => { failed++; console.error('✖', m); };
const pass = (m) => console.log('✔', m);
const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (query) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE + query);
  await page.waitForSelector('#go-sound:not([disabled])');
  return { ctx, page };
};
const H = () => window.__plainhunt;
try {
  // Italian subtitles: the start screen and the story in Italian, the English voice under them
  let { ctx, page } = await open('?lang=it');
  const start = await page.evaluate(() => ({ title: document.getElementById('start-title').textContent, go: document.getElementById('go-sound').textContent,
    lang: document.documentElement.lang, selects: [...document.querySelectorAll('#langs select')].map((s) => s.value) }));
  start.lang === 'it' && /Plain Hunt/.test(start.title) && !/Begin/.test(start.go) && start.selects.join() === 'it'
    ? pass(`the start screen is in Italian ("${start.go}"), with one choice, the subtitles`) : fail(`start: ${JSON.stringify(start)}`);
  await page.click('#go-sound');
  await page.waitForFunction(() => window.__plainhunt.page === 1 && /\/vo\/p1-open-\d\.mp3$/.test(window.__plainhunt.playing || ''), null, { timeout: 15000 })
    .then(() => pass('the English voice plays (media/vo/), under Italian words')).catch(async () => fail(`voice: ${await page.evaluate(() => window.__plainhunt.playing)}`));
  const text = await page.evaluate(() => ({ ink: document.querySelector('.ink').textContent, folio: document.getElementById('folio').textContent,
    alt: document.getElementById('tower').getAttribute('aria-label') }));
  /Tuesday|tower captain/.test(text.ink) || !/ottobre|martedì/i.test(text.ink) ? fail(`story text not Italian: ${text.ink.slice(0, 120)}`) : pass(`the subtitles are Italian: "${text.ink.slice(0, 60)}…"`);
  text.folio.includes('1 / 10') && text.alt && !/^The church tower/.test(text.alt)
    ? pass(`the page title and panel descriptions are Italian ("${text.folio}")`) : fail(`folio/alt: ${JSON.stringify(text)}`);
  await ctx.close();

  // English stays English, and offers the subtitles
  ({ ctx, page } = await open(''));
  const en = await page.evaluate(() => ({ go: document.getElementById('go-sound').textContent, opts: [...document.querySelectorAll('#langs select')][0]?.options.length,
    selects: document.querySelectorAll('#langs select').length }));
  en.go === 'Begin, with sound' && en.opts === 2 && en.selects === 1 ? pass('English by default, with English and Italian subtitles offered') : fail(`english: ${JSON.stringify(en)}`);
  await ctx.close();
  errors.length ? fail('errors: ' + errors.slice(0, 4).join(' | ')) : pass('no page errors or failed requests');
} finally { await browser.close(); server.kill(); }
console.log(failed ? '\nPLAIN HUNT (subtitles): FAIL' : '\nPLAIN HUNT (subtitles): PASS');
process.exit(failed ? 1 : 0);
