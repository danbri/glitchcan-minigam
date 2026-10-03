// Lock Fourteen (cozyverse/mystery3/index.html), on a phone-sized touch screen: the full solving route over three days
// (tools/route.mjs "full"), each page's sound bed, four panels on every page, the canary showing once on the lane
// panel, every picture and sound file present, the ending knowing it was solved with the second post-mortem, the
// village remembering Quaile, and a tap and a double tap on a panel.
// Routes and voices are checked offline: cozyverse/mystery3/tools/route.mjs, steeplewyke/tools/lines.mjs (STORY=../mystery3).
//   node inklet/finkapp/test/e2e-lockfourteen.mjs        (SHOTS=dir saves a screenshot of each page)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const PORT = 8182;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}/${basename(repoRoot)}/cozyverse/mystery3/`;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', join(repoRoot, '..')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
let failed = 0;
const fail = (m) => { failed++; console.error('✖', m); };
const pass = (m) => console.log('✔', m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// the "full" route of tools/route.mjs; a move matches the first offered choice that starts with it or contains it
const PATH = [
  'Take the coffee', 'Ask him how a lock works', 'Walk up to lock fifteen', 'Look at the bag', 'Go to your car',
  'Walk up the flight', 'Sign for', 'Read the minutes', 'Leave',
  'Go down to the hire boat', 'Knock at the side hatch', 'Talk to the man on the roof', 'Show him something', "Maaike's photograph at 22:41", 'Leave',
  'Look at the board before bed', 'Lock fourteen full', 'How a lock works', 'Leave the board', 'Go to bed',
  "Go to the coroner's office", 'Take the call', 'Thank her', 'Talk to Sam', 'Leave', 'Phone the coroner',
  'Call on Annette', 'Talk to Annette', 'Ask about Thursday', 'Ask to see the photographs', 'Ask about the gates', 'Leave',
  'Look at the board before bed', 'He drowned', 'Someone filled', 'The chained post', 'Two keys', 'Leave the board', 'Go to bed',
  'Go to the Navigation', 'Talk to the landlord', 'Ask what he saw', 'Leave',
  'Call on Clive', 'Talk to Clive', 'Show him something', 'Pete Garrow saw', 'Show him something', "Neville's photographs at 23:13", 'Ask to see the windlass', 'Leave',
  'Go to bed', 'Write the report', 'Unlawful killing', 'drowned when someone filled it', 'for the death', 'Clive Amory',
];

const data = JSON.parse(readFileSync(join(repoRoot, 'cozyverse/mystery3/pages.json'), 'utf8'));
const voices = JSON.parse(readFileSync(join(repoRoot, 'cozyverse/mystery3/voices.json'), 'utf8'));
const VOICED = voices.recorded !== false;
const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], missing = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || /\[marrow\]/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });

  const want = [];
  for (const p of data.pages) {
    want.push(`media/sfx/bed-${p.n}.mp3`);
    for (const x of p.panels) {
      want.push(`media/p${p.n}-${x.knot}.jpg`);
      if (!x.noSound) want.push(`media/sfx/p${p.n}-${x.knot}.mp3`);
      for (const b of x.loopSrc || []) want.push(`${b}.webm`, `${b}.mp4`);
      if (x.peek?.src) want.push(`${x.peek.src}.webm`, `${x.peek.src}.mp4`);
    }
  }
  if (VOICED) for (const id of Object.keys(voices.lines))
    for (let k = 1; k <= (voices.takes || 1) + ((voices.secondTake || []).includes(id) ? 1 : 0); k++) want.push(`media/vo/${id}-${k}.mp3`);
  const absent = [];
  for (const f of want) if (!(await page.request.head(BASE + f)).ok()) absent.push(f);
  absent.length ? fail(`files missing (${absent.length}): ${absent.slice(0, 8).join(', ')}`) : pass(`all ${want.length} pictures, loops, sounds${VOICED ? ' and voice takes' : ''} are present`);

  const peekPanel = data.pages.flatMap((p) => p.panels).find((x) => x.peek?.src)?.knot;
  await page.goto(BASE + (peekPanel ? `?canary=${peekPanel}` : ''));
  await page.waitForSelector('#go-sound:not([disabled])');
  await page.click('#go-sound');
  await page.waitForFunction(() => window.__lock14.page === 1 && window.__lock14.bed === 'media/sfx/bed-1.mp3', null, { timeout: 15000 })
    .then(() => pass(`Begin with sound: page 1 and its sound bed${VOICED ? '' : ' (voices not recorded yet: none asked for)'}`)).catch(() => fail('page 1 did not start'));

  // a short loop plays on the lock panel, and a looping panel has no vignette
  if (data.pages[0].panels.find((x) => x.knot === 'lock').loopSrc) {
    await page.waitForFunction(() => [...document.getElementById('lock').querySelectorAll('video')].some((x) => x.style.opacity === '1' && !x.paused), null, { timeout: 8000 }).catch(() => {});
    const lock = await page.evaluate(() => { const s = document.getElementById('lock'); const v = [...s.querySelectorAll('video')].find((x) => x.style.opacity === '1');
      return { playing: !!v && !v.paused, shade: getComputedStyle(s, '::after').boxShadow !== 'none' }; });
    lock.playing && !lock.shade ? pass('the lock panel plays its short loop, with no vignette') : fail(`lock loop: ${JSON.stringify(lock)}`);
  }

  const shot = async (n) => { if (process.env.SHOTS) { await wait(1500); await page.screenshot({ path: `${process.env.SHOTS}/page${String(n).padStart(2, '0')}.png` }); } };
  await shot(1);
  const pick = (m) => page.evaluate((m) => { const b = [...document.querySelectorAll('.ink .choice')];
    const c = b.find((x) => x.textContent.startsWith(m)) || b.find((x) => x.textContent.includes(m)); if (c) c.click(); return !!c; }, m);
  let pageWrong = [], bedWrong = [], quiet = [], small = 0, seen = new Set([1]), peekSeen = false;
  for (const move of PATH) {
    const ok = await page.waitForFunction((m) => [...document.querySelectorAll('.ink .choice')].some((b) => b.textContent.startsWith(m) || b.textContent.includes(m)), move, { timeout: 15000 }).then(() => true, () => false);
    if (!ok) { fail(`no choice "${move}"; offered: ${await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].map((b) => b.textContent).join(' | '))}`); break; }
    small += await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].filter((b) => b.getBoundingClientRect().height < 44).length);
    await pick(move);
    if (VOICED) await page.waitForFunction(() => (window.__lock14.playing || '').includes('/vo/'), null, { timeout: 10000 }).catch(() => quiet.push(move));
    else await wait(250);
    const st = await page.evaluate(() => ({ page: window.__lock14.page, bed: window.__lock14.bed, sections: document.querySelectorAll('#page > section').length }));
    if (st.sections !== 4) pageWrong.push(`${move}: page ${st.page}, ${st.sections} panels`);
    if (st.bed !== `media/sfx/bed-${st.page}.mp3`) bedWrong.push(`${move}: page ${st.page}, bed ${st.bed}`);
    if (!seen.has(st.page)) { seen.add(st.page); await shot(st.page); }
    // the canary was given to the lane panel by ?canary=: it peeks once, two seconds after that page shows
    if (peekPanel && !peekSeen && st.page === 4) {
      peekSeen = true;
      await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('peeking') || window.__lock14.canary.done, peekPanel, { timeout: 12000 })
        .then(() => pass(`the ${peekPanel} panel shows the canary once`))
        .catch(async () => fail(`no peek on the ${peekPanel} panel`));
      await page.waitForFunction((id) => { const s = document.getElementById(id), v = s?.querySelector('video');
        return s && !s.classList.contains('peeking') && v && v.paused && v.currentTime === 0; }, peekPanel, { timeout: 8000 })
        .then(() => pass('the peek ends and the panel holds its still again')).catch(() => fail('the peek did not end'));
    }
  }
  if (VOICED) quiet.length ? fail(`no voice after: ${quiet.join('; ')}`) : pass(`a voice take plays after each of the ${PATH.length} choices`);
  else console.log('- voices not recorded yet (voices.json "recorded": false): voice checks skipped');
  pageWrong.length ? fail(`panels: ${pageWrong.slice(0, 4).join('; ')}`) : pass(`four panels on every page; pages seen: ${[...seen].sort((a, b) => a - b).join(', ')}`);
  // page 7 (the top gate) is an optional visit: the full route solves the case without it
  seen.size === 9 && !seen.has(7) ? pass('the route shows every page but the optional gate (7)') : fail(`the route shows pages ${[...seen]}`);
  bedWrong.length ? fail(`wrong bed: ${bedWrong.slice(0, 4).join('; ')}`) : pass('each page plays its own sound bed');
  small ? fail(`${small} choice buttons under 44 px`) : pass('every choice button is at least 44 px tall');

  const end = await page.evaluate(() => ({ text: document.querySelector('.ink').textContent, ending: window.__lock14.story.variablesState.ending,
    cards: window.__lock14.story.EvaluateFunction('evidence') }));
  end.ending === 'full' && /You solved Lock Fourteen/.test(end.text) && end.cards === 3
    ? pass('the ending says the case is solved (three cards, the second post-mortem)') : fail(`ending: ${JSON.stringify({ ...end, text: end.text.slice(-120) })}`);
  const vil = await page.evaluate(() => window.__lock14.village);
  vil.quaile === 1 ? pass('the village remembers: Quaile +1 saved in this browser') : fail(`village after the reading: ${JSON.stringify(vil)}`);

  // Begin again, then a tap into a panel: the story follows the tap and that panel's own sound comes in over the bed
  await pick('Begin again');
  await page.waitForFunction(() => window.__lock14.page === 1 && window.__lock14.story.variablesState.day === 1, null, { timeout: 10000 })
    .then(() => pass('Begin again goes back to page 1, day one')).catch(() => fail('Begin again did not reset'));
  await wait(1200);
  const centre = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
  const box = await centre('bag');
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(() => window.__lock14.panelSound === 'media/sfx/p1-bag.mp3' && /exhibit bag/.test(document.querySelector('.ink').textContent), null, { timeout: 10000 })
    .then(() => pass('a tap on the bag panel takes the story there and brings in its sound'))
    .catch(async () => fail(`tap: ${JSON.stringify(await page.evaluate(() => ({ s: window.__lock14.panelSound, t: document.querySelector('.ink').textContent.slice(0, 80) })))}`));
  // a double tap counts as one tap (wait first: two taps within 350 ms are one double tap)
  await wait(600);
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(() => document.getElementById('page').current === -1, null, { timeout: 5000 }).catch(() => {});
  await wait(1600);
  const lock = await centre('lock');
  await page.mouse.dblclick(lock.x, lock.y);
  await wait(1800);
  const dbl = await page.evaluate(() => { const p = document.getElementById('page'); return p.current >= 0 ? p.panels[p.current].id : 'overview'; });
  dbl === 'lock' ? pass('a double tap on a panel goes into it, as one tap does') : fail(`after a double tap the view is on ${dbl}`);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  sideways > 1 ? fail(`sideways scroll ${sideways} px`) : pass('no sideways scroll at 390 px');
  missing.length ? fail(`failed requests: ${missing.slice(0, 6).join(', ')}`) : pass('no failed requests');
  errors.length ? fail('errors: ' + errors.slice(0, 4).join(' | ')) : pass('no page errors');
} finally { await browser.close(); server.kill(); }
console.log(failed ? '\nLOCK FOURTEEN: FAIL' : '\nLOCK FOURTEEN: PASS');
process.exit(failed ? 1 : 0);
