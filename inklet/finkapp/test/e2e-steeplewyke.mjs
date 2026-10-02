// Steeple Wyke: The Marrow Show (cozyverse/steeplewyke/index.html) on a phone-sized touch screen: the solving path
// through all ten pages, a voice take after every choice, each page's sound bed, a panel's own sound when a tap
// takes the view into it, a looping panel going on from one loop to another, every picture, loop and sound file present, and the ending knowing it was solved.
//   node inklet/finkapp/test/e2e-steeplewyke.mjs        (SHOTS=dir saves a screenshot of each page)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const PORT = 8179;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}/${basename(repoRoot)}/cozyverse/steeplewyke/`;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', join(repoRoot, '..')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
let failed = 0;
const fail = (m) => { failed++; console.error('✖', m); };
const pass = (m) => console.log('✔', m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// [choice label, page the story is on after it]
const PATH = [
  ['Find DCI Quaile', 1], ['Hold the spoons', 1], ['Walk along the scarecrows', 1], ['Run to the produce tent', 2],
  ['Check on him', 2], ["Look at what's on the grass", 2], ['Tell Quaile what you think', 2], ['Go and find Margaret Pike', 3],
  ['Tell her', 3], ['Ask about his flask', 3], ['Ask about her secateurs', 3], ['Count them', 3], ['Go back to the show', 4],
  ['Talk to her', 4], ["Ask what's in her apron pocket", 4], ['Look at her marrow', 4], ["Find Gerald's son", 5],
  ['Wait for him to finish', 5], ["Ask where he was at two o'clock", 5], ['Walk him back to his car', 5], ['Go to the vicarage', 6],
  ['Find the vicar', 6], ['Ask about his garden', 6], ['Ask to see the hall kitchen', 6], ['Go out and look at the roof', 6],
  ["Go to Gerald's study", 7], ['Search the desk', 7], ['Look at the cups on the shelf', 7], ['Go to the pub and think', 8],
  ['Sit down with Quaile', 8], ['Go through your notebook', 8], ['Look round the bar', 8], ['Go to the prize-giving', 9],
  ['Listen to the vicar', 9], ['Stand up', 9], ['Name the vicar', 9], ['Go out into the evening', 10],
  ['Say goodbye to Margaret', 10], ['Walk to the car', 10], ['Drive past the scarecrows', 10],
];

const data = JSON.parse(readFileSync(join(repoRoot, 'cozyverse/steeplewyke/pages.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], missing = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || /\[marrow\]/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });

  // every file the ten pages name is there
  const want = [];
  for (const p of data.pages) {
    want.push(`media/sfx/bed-${p.n}.mp3`);
    for (const x of p.panels) {
      want.push(`media/p${p.n}-${x.knot}.jpg`, `media/sfx/p${p.n}-${x.knot}.mp3`);
      (x.loops || []).forEach((_, k) => want.push(`media/p${p.n}-${x.knot}-loop${k + 1}.webm`, `media/p${p.n}-${x.knot}-loop${k + 1}.mp4`));
    }
  }
  const absent = [];
  for (const f of want) if (!(await page.request.head(BASE + f)).ok()) absent.push(f);
  absent.length ? fail(`files missing: ${absent.join(', ')}`) : pass(`all ${want.length} pictures, loops and sounds are present`);

  await page.goto(BASE);
  await page.waitForSelector('#go-sound:not([disabled])');
  await page.click('#go-sound');
  await page.waitForFunction(() => window.__marrow.page === 1 && (window.__marrow.playing || '').includes('/vo/p1-open-'), null, { timeout: 15000 })
    .then(() => pass('Begin with sound: page 1, the opening line plays')).catch(() => fail('the opening line did not play'));

  const shot = async (n) => { if (process.env.SHOTS) { await wait(1500); await page.screenshot({ path: `${process.env.SHOTS}/page${String(n).padStart(2, '0')}.png` }); } };
  await shot(1);
  let quiet = [], pageWrong = [], bedWrong = [], small = 0, seenPages = new Set([1]);
  for (const [label, n] of PATH) {
    const ok = await page.waitForFunction((t) => [...document.querySelectorAll('.ink .choice')].some((b) => b.textContent === t), label, { timeout: 15000 }).then(() => true, () => false);
    if (!ok) { fail(`no choice "${label}"; offered: ${await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].map((b) => b.textContent).join(' | '))}`); break; }
    small += await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].filter((b) => b.getBoundingClientRect().height < 44).length);
    await page.evaluate((t) => [...document.querySelectorAll('.ink .choice')].find((b) => b.textContent === t).click(), label);
    await page.waitForFunction(() => (window.__marrow.playing || '').includes('/vo/'), null, { timeout: 10000 }).catch(() => quiet.push(label));
    const st = await page.evaluate(() => ({ page: window.__marrow.page, bed: window.__marrow.bed, sections: document.querySelectorAll('#page > section').length }));
    if (st.page !== n || st.sections !== 4) pageWrong.push(`${label}: page ${st.page}, ${st.sections} panels`);
    if (st.bed !== `media/sfx/bed-${n}.mp3`) bedWrong.push(`${label}: ${st.bed}`);
    if (!seenPages.has(n)) { seenPages.add(n); await shot(n); }
  }
  quiet.length ? fail(`no voice after: ${quiet.join('; ')}`) : pass(`a voice take plays after each of the ${PATH.length} choices`);
  pageWrong.length ? fail(`wrong page: ${pageWrong.join('; ')}`) : pass(`all ten pages turned, four panels each (${[...seenPages].join(', ')})`);
  bedWrong.length ? fail(`wrong bed: ${bedWrong.join('; ')}`) : pass('each page plays its own sound bed');
  small ? fail(`${small} choice buttons under 44 px`) : pass('every choice button is at least 44 px tall');

  const end = await page.evaluate(() => ({ text: document.querySelector('.ink').textContent, solved: window.__marrow.story.variablesState.solved }));
  end.solved === true && /You solved the Marrow Show/.test(end.text) ? pass('the ending says the case is solved') : fail(`ending: ${JSON.stringify(end)}`);

  // Begin again, then a tap into a panel: the story follows the tap and that panel's own sound comes in over the bed
  await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].find((b) => b.textContent === 'Begin again').click());
  await page.waitForFunction(() => window.__marrow.page === 1 && window.__marrow.story.variablesState.flask === false, null, { timeout: 10000 })
    .then(() => pass('Begin again goes back to page 1 with no clues')).catch(() => fail('Begin again did not reset'));
  await wait(1200);
  const box = await page.evaluate(() => { const r = document.getElementById('scarecrows').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(() => window.__marrow.panelSound === 'media/sfx/p1-scarecrows.mp3' && /scarecrow competition/.test(document.querySelector('.ink').textContent), null, { timeout: 10000 })
    .then(() => pass('a tap on the scarecrows panel takes the story there and brings in its sound'))
    .catch(async () => fail(`tap: ${JSON.stringify(await page.evaluate(() => ({ s: window.__marrow.panelSound, t: document.querySelector('.ink').textContent.slice(0, 80) })))}`));

  // the looping panel plays one loop, keeps the next one waiting at its first frame (its poster is the same still,
  // so metadata is enough), and goes on to a different one
  const loopsOf = () => page.evaluate(() => [...document.querySelectorAll('#show video')].map((v) => ({
    src: v.currentSrc.split('/').pop(), ready: v.readyState, shown: v.style.visibility !== 'hidden', paused: v.paused })));
  const first = await loopsOf();
  const shown0 = first.find((v) => v.shown);
  first.length === 2 && shown0 && !shown0.paused && shown0.ready >= 2 && first.every((v) => v.ready >= 1) && first[0].src !== first[1].src
    ? pass(`page 1 loop plays (${shown0.src}) with a different loop waiting`) : fail(`loops: ${JSON.stringify(first)}`);
  await page.waitForFunction((s) => { const v = [...document.querySelectorAll('#show video')].find((x) => x.style.visibility !== 'hidden'); return v && !v.currentSrc.endsWith(s) && !v.paused; },
    shown0?.src, { timeout: 15000 }).then(async () => pass(`at its end the panel goes on to ${(await loopsOf()).find((v) => v.shown).src}`))
    .catch(async () => fail(`the loop did not change: ${JSON.stringify(await loopsOf())}`));
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  sideways > 1 ? fail(`sideways scroll ${sideways} px`) : pass('no sideways scroll at 390 px');
  missing.length ? fail(`failed requests: ${missing.join(', ')}`) : pass('no failed requests');
  errors.length ? fail('errors: ' + errors.slice(0, 4).join(' | ')) : pass('no page errors');
} finally { await browser.close(); server.kill(); }
console.log(failed ? '\nSTEEPLE WYKE: FAIL' : '\nSTEEPLE WYKE: PASS');
process.exit(failed ? 1 : 0);
