// Steeple Wyke: The Marrow Show, version 2 (cozyverse/steeplewyke/v2/index.html), on a phone-sized touch screen: one solving
// route through all ten pages (the hub of inquiries between them), a voice take after every choice, each page's
// sound bed, a panel's own sound when a tap takes the view into it, a double tap counting as one tap, a looping
// panel going on from one loop to another, every picture, loop and sound file present, and the ending knowing it
// was solved, and the village remembering what you did (the notice, the saved standing, and the next reading starting
// from it). The variety of routes is checked offline: node cozyverse/steeplewyke/tools/walk.mjs
//   node inklet/finkapp/test/e2e-steeplewyke-v2.mjs        (SHOTS=dir saves a screenshot of each page)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const PORT = 8179;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}/${basename(repoRoot)}/cozyverse/steeplewyke/v2/`;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', join(repoRoot, '..')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
let failed = 0;
const fail = (m) => { failed++; console.error('✖', m); };
const pass = (m) => console.log('✔', m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// [choice label, page the story is on after it]. One solving route through the inquiries hub (pages 3 to 7 in any
// order, four of five): the vicarage before the study (so the vicar has been in the study), Margaret shown the
// flask, Dilys asked about the argument. The hub knot keeps the page it was reached from.
const PATH = [
  ['Find DCI Quaile', 1], ['Hold the spoons', 1], ['Walk along the scarecrows', 1], ['Run to the produce tent', 2],
  ['Check on him', 2], ["Look at what's on the grass", 2], ['Tell Quaile what you think', 2], ['Decide where to start', 2],
  ['Call on the vicar', 6], ['Find the vicar', 6], ['Ask about his garden', 6], ['Ask to see the hall kitchen', 6],
  ['Go out and look at the roof', 6], ['Leave the vicar to his roof', 6],
  ["Search Gerald's study", 7], ['Search the desk', 7], ['Leave the study', 7],
  ["Go to Margaret Pike's cottage", 3], ['Talk to her', 3], ['Ask about his flask', 3], ['Show her the church-hall flask', 3],
  ['Ask about the foxgloves', 3], ['Leave her to the roses', 3],
  ['Go back to the marrow tent', 4], ['Talk to her', 4], ['Ask who Gerald argued with today', 4], ['Look at her marrow', 4],
  ['Leave the tent', 4], ['Go to the pub', 8],
  ['Sit down with Quaile', 8], ['Ask her what she thinks', 8], ['Go through your notebook', 8], ['Go to the prize-giving', 9],
  ['Listen to the vicar', 9], ['Stand up', 9], ['Name the vicar', 9], ['Go out into the evening', 10],
  ['Say goodbye to Margaret', 10], ['Walk to the car', 10], ['Drive past the scarecrows', 10],
];

const data = JSON.parse(readFileSync(join(repoRoot, 'cozyverse/steeplewyke/v2/pages.json'), 'utf8'));
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
    want.push(`../media/sfx/bed-${p.n}.mp3`);
    for (const x of p.panels) {
      want.push(`../media/p${p.n}-${x.knot}.jpg`, `../media/sfx/p${p.n}-${x.knot}.mp3`);
      for (const b of x.loopSrc || []) want.push(`${b}.webm`, `${b}.mp4`);
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
  let quiet = [], pageWrong = [], bedWrong = [], small = 0, seenPages = new Set([1]), memSeen = null;
  for (const [label, n] of PATH) {
    const ok = await page.waitForFunction((t) => [...document.querySelectorAll('.ink .choice')].some((b) => b.textContent === t), label, { timeout: 15000 }).then(() => true, () => false);
    if (!ok) { fail(`no choice "${label}"; offered: ${await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].map((b) => b.textContent).join(' | '))}`); break; }
    small += await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].filter((b) => b.getBoundingClientRect().height < 44).length);
    await page.evaluate((t) => [...document.querySelectorAll('.ink .choice')].find((b) => b.textContent === t).click(), label);
    await page.waitForFunction(() => (window.__marrow.playing || '').includes('/vo/'), null, { timeout: 10000 }).catch(() => quiet.push(label));
    const st = await page.evaluate(() => ({ page: window.__marrow.page, bed: window.__marrow.bed, sections: document.querySelectorAll('#page > section').length }));
    if (st.page !== n || st.sections !== 4) pageWrong.push(`${label}: page ${st.page}, ${st.sections} panels`);
    if (st.bed !== `../media/sfx/bed-${n}.mp3`) bedWrong.push(`${label}: ${st.bed}`);
    if (!memSeen) memSeen = await page.evaluate(() => window.__marrow.memory);
    if (!seenPages.has(n)) { seenPages.add(n); await shot(n); }
  }
  quiet.length ? fail(`no voice after: ${quiet.join('; ')}`) : pass(`a voice take plays after each of the ${PATH.length} choices`);
  pageWrong.length ? fail(`wrong page: ${pageWrong.join('; ')}`) : pass(`${seenPages.size} pages turned in the order this route takes, four panels each (${[...seenPages].join(', ')})`);
  bedWrong.length ? fail(`wrong bed: ${bedWrong.join('; ')}`) : pass('each page plays its own sound bed');
  small ? fail(`${small} choice buttons under 44 px`) : pass('every choice button is at least 44 px tall');

  const end = await page.evaluate(() => ({ text: document.querySelector('.ink').textContent, ending: window.__marrow.story.variablesState.ending,
    evidence: window.__marrow.story.EvaluateFunction('evidence') }));
  end.ending === 'solved' && /You solved the Marrow Show/.test(end.text) && end.evidence >= 5
    ? pass(`the ending says the case is solved (evidence ${end.evidence} of 7)`) : fail(`ending: ${JSON.stringify(end)}`);

  // the village remembers: asking Quaile (page 8) and naming the vicar yourself each raise her opinion of you; the
  // standing is saved, and the next reading starts from it (was_quaile), so her first line at the pub changes
  const vil = await page.evaluate(() => window.__marrow.village);
  vil.quaile === 2 ? pass('the village remembers: Quaile +2 saved in this browser') : fail(`village after the reading: ${JSON.stringify(vil)}`);
  memSeen ? pass(`a memory notice showed: "${memSeen}"`) : fail('no memory notice showed');

  // Begin again, then a tap into a panel: the story follows the tap and that panel's own sound comes in over the bed
  await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].find((b) => b.textContent === 'Begin again').click());
  await page.waitForFunction(() => window.__marrow.page === 1 && window.__marrow.story.variablesState.visits === 0 && window.__marrow.story.variablesState.flask === false, null, { timeout: 10000 })
    .then(() => pass('Begin again goes back to page 1 with no clues')).catch(() => fail('Begin again did not reset'));
  const was = await page.evaluate(() => [window.__marrow.story.variablesState.was_quaile, window.__marrow.story.variablesState.rel_quaile]);
  was[0] === 2 && was[1] === 2 ? pass('the next reading starts from what the village remembers') : fail(`next reading: was/rel quaile ${was}`);
  await wait(1200);
  const box = await page.evaluate(() => { const r = document.getElementById('scarecrows').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(() => window.__marrow.panelSound === '../media/sfx/p1-scarecrows.mp3' && /scarecrow competition/.test(document.querySelector('.ink').textContent), null, { timeout: 10000 })
    .then(() => pass('a tap on the scarecrows panel takes the story there and brings in its sound'))
    .catch(async () => fail(`tap: ${JSON.stringify(await page.evaluate(() => ({ s: window.__marrow.panelSound, t: document.querySelector('.ink').textContent.slice(0, 80) })))}`));

  // a double tap counts as one tap: back to the overview, then a double tap on the show panel leaves the view in it.
  // Wait first: a second tap within 350 ms at the same point IS a double tap, and would be taken as one.
  await wait(600);
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(() => document.getElementById('page').current === -1, null, { timeout: 5000 }).catch(() => {});
  // back on a page already read, the story says something short
  await page.waitForFunction(() => /The show field: chutney, the tannoy, the scarecrows/.test(document.querySelector('.ink').textContent), null, { timeout: 5000 })
    .then(() => pass('a page read before gets a short line when the view goes back to it'))
    .catch(async () => fail(`page again: ${await page.evaluate(() => document.querySelector('.ink').textContent.slice(0, 120))}`));
  // a still panel is marked as a still (vignette, no slow zoom), a looping one is not
  const marks = await page.evaluate(() => ['chutney', 'show'].map((id) => { const s = document.getElementById(id);
    return { id, shade: getComputedStyle(s, '::after').boxShadow !== 'none', moving: (s.querySelector('img')?.getAnimations() || []).length };
  }));
  marks[0].shade && !marks[0].moving && !marks[1].shade ? pass('a still panel has a vignette and does not move; a looping panel has no vignette')
    : fail(`still/loop marks: ${JSON.stringify(marks)}`);
  await wait(1600);
  const show = await page.evaluate(() => { const r = document.getElementById('show').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.dblclick(show.x, show.y);
  await wait(1800);
  const dbl = await page.evaluate(() => { const p = document.getElementById('page'); return p.current >= 0 ? p.panels[p.current].id : 'overview'; });
  dbl === 'show' ? pass('a double tap on a panel goes into it, as one tap does') : fail(`after a double tap the view is on ${dbl}`);

  // the looping panel plays one loop, keeps the next one waiting at its first frame (its poster is the same still,
  // so metadata is enough), and goes on to a different one
  const loopsOf = () => page.evaluate(() => [...document.querySelectorAll('#show video')].map((v) => ({
    src: v.currentSrc.split('/').pop(), ready: v.readyState, shown: v.style.opacity === '1', paused: v.paused })));
  // sample between hand-overs: during the 0.3 s cross-fade both videos are visible
  await page.waitForFunction(() => [...document.querySelectorAll('#show video')].filter((v) => v.style.opacity === '1').length === 1, null, { timeout: 8000 }).catch(() => {});
  const first = await loopsOf();
  const shown0 = first.find((v) => v.shown);
  first.length === 2 && shown0 && !shown0.paused && shown0.ready >= 2 && first.every((v) => v.ready >= 1) && first[0].src !== first[1].src
    ? pass(`page 1 loop plays (${shown0.src}) with a different loop waiting`) : fail(`loops: ${JSON.stringify(first)}`);
  await page.waitForFunction((s) => { const v = [...document.querySelectorAll('#show video')].find((x) => x.style.opacity === '1'); return v && !v.currentSrc.endsWith(s) && !v.paused; },
    shown0?.src, { timeout: 15000 }).then(async () => pass(`at its end the panel goes on to ${(await loopsOf()).find((v) => v.shown).src}`))
    .catch(async () => fail(`the loop did not change: ${JSON.stringify(await loopsOf())}`));
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  sideways > 1 ? fail(`sideways scroll ${sideways} px`) : pass('no sideways scroll at 390 px');
  missing.length ? fail(`failed requests: ${missing.join(', ')}`) : pass('no failed requests');
  errors.length ? fail('errors: ' + errors.slice(0, 4).join(' | ')) : pass('no page errors');
} finally { await browser.close(); server.kill(); }
console.log(failed ? '\nSTEEPLE WYKE: FAIL' : '\nSTEEPLE WYKE: PASS');
process.exit(failed ? 1 : 0);
