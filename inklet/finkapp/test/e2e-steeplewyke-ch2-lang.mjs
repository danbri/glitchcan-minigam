// Steeple Wyke, chapter 2, in another language (cozyverse/steeplewyke/ch2/index.html?lang=it): the start screen and
// the story in Italian, the language choices on the start screen, Italian voices where they are recorded (a sample:
// voices.it.json "only"), and Italian text over English voices (?lang=it&voice=en: the text is the subtitles). That a
// translation behaves like the English story is checked offline: node cozyverse/steeplewyke/tools/lang-check.mjs it
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
  // Italian text, Italian voices (the recorded sample)
  let { ctx, page } = await open('?lang=it&voice=it');
  const start = await page.evaluate(() => ({ title: document.getElementById('start-title').textContent, go: document.getElementById('go-sound').textContent,
    lang: document.documentElement.lang, selects: [...document.querySelectorAll('#langs select')].map((s) => s.value) }));
  start.lang === 'it' && /Plain Hunt/.test(start.title) && !/Begin/.test(start.go) && start.selects.join() === 'it,it'
    ? pass(`the start screen is in Italian ("${start.go}"), with text and voice choices set to Italian`) : fail(`start: ${JSON.stringify(start)}`);
  await page.click('#go-sound');
  await page.waitForFunction(() => window.__plainhunt.page === 1 && (window.__plainhunt.playing || '').includes('/vo/it/p1-open-'), null, { timeout: 15000 })
    .then(() => pass('page 1 opens with the Italian voice (media/vo/it/)')).catch(async () => fail(`no Italian voice: ${await page.evaluate(() => window.__plainhunt.playing)}`));
  const text = await page.evaluate(() => ({ ink: document.querySelector('.ink').textContent, folio: document.getElementById('folio').textContent,
    alt: document.getElementById('tower').getAttribute('aria-label') }));
  /Tuesday|tower captain/.test(text.ink) || !/ottobre|martedì/i.test(text.ink) ? fail(`story text not Italian: ${text.ink.slice(0, 120)}`) : pass(`the story is in Italian: "${text.ink.slice(0, 60)}…"`);
  text.folio.includes('1 / 10') && text.alt && text.alt !== 'The church tower of St Aldhelm\'s at dusk, rooks circling the spire, one lit window high up in the tower.'
    ? pass(`the page title and panel descriptions are Italian ("${text.folio}")`) : fail(`folio/alt: ${JSON.stringify(text)}`);
  await ctx.close();

  // Italian text over English voices: the text is the subtitles
  ({ ctx, page } = await open('?lang=it&voice=en'));
  await page.click('#go-sound');
  await page.waitForFunction(() => (window.__plainhunt.playing || '').includes('/vo/p1-open-') && !window.__plainhunt.playing.includes('/vo/it/'), null, { timeout: 15000 })
    .then(() => pass('Italian text with English voices: the English take plays under the Italian words'))
    .catch(async () => fail(`voice: ${await page.evaluate(() => window.__plainhunt.playing)}`));
  const it2 = await page.evaluate(() => [window.__plainhunt.lang, window.__plainhunt.voiceLang]);
  it2.join() === 'it,en' ? pass('text language it, voice language en') : fail(`languages: ${it2}`);
  await ctx.close();

  // English stays English, and offers the choice
  ({ ctx, page } = await open(''));
  const en = await page.evaluate(() => ({ go: document.getElementById('go-sound').textContent, opts: [...document.querySelectorAll('#langs select')][0]?.options.length }));
  en.go === 'Begin, with sound' && en.opts === 2 ? pass('English by default, with English and Italian offered') : fail(`english: ${JSON.stringify(en)}`);
  await ctx.close();
  errors.length ? fail('errors: ' + errors.slice(0, 4).join(' | ')) : pass('no page errors or failed requests');
} finally { await browser.close(); server.kill(); }
console.log(failed ? '\nPLAIN HUNT (languages): FAIL' : '\nPLAIN HUNT (languages): PASS');
process.exit(failed ? 1 : 0);
