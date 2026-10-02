// Steeple Wyke, chapter 2: Plain Hunt (cozyverse/steeplewyke/ch2/index.html), on a phone-sized touch screen: one
// solving route through all ten pages (the hub of inquiries, then the bell puzzle on page 9 with one wrong guess), a
// voice take after every choice, each page's sound bed, the canary showing once, on one panel (it is rare), a short loop playing,
// every picture, loop and sound file present, the ending knowing it was solved, the village remembering (the notice,
// the saved standing, Dr Achebe added to chapter 1's people), and a tap and a double tap on a panel.
// Routes, rows and voices are checked offline: tools/walk.mjs, tools/rows.mjs, tools/lines.mjs (STORY=ch2).
//   node inklet/finkapp/test/e2e-steeplewyke-ch2.mjs        (SHOTS=dir saves a screenshot of each page)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const PORT = 8181;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}/${basename(repoRoot)}/cozyverse/steeplewyke/ch2/`;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', join(repoRoot, '..')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
let failed = 0;
const fail = (m) => { failed++; console.error('✖', m); };
const pass = (m) => console.log('✔', m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// [choice label, page the story is on after it]. The ringing route: the blackboard (the band moved up one), Dilys
// asked about her recording (Glenys's email arrives in the morning), Jeremy's lie, the barn, the board, the quiz, the
// drone, then the puzzle (one wrong bell first) and Jeremy named on Sunday. The hub keeps the page it was reached from.
const PATH = [
  ['Meet the tower captain', 1], ['Ask what plain hunt is', 1], ['Put the napkin in your pocket and go up', 2],
  ['Read the blackboard', 2], ['Sit on the bench and watch', 2], ['Wait', 2], ['Run down the stair', 3],
  ['Look at the stair', 3], ['Look at his hand', 3], ['Wait for Quaile', 3], ['Question the band', 3],
  ['Ask Dilys about her phone', 3], ['Let them go home', 3],
  ['Call on Jeremy Cole at his barn', 5], ['Find Jeremy Cole', 5], ['Ask where he was at a quarter past eight', 5],
  ['Look at the trestle at the back', 5], ['Go out past his van', 5], ['Leave him to his dresser', 5],
  ['Look at the peal board in the tower', 8], ['Look at the board', 8], ['Look closely with the glass', 8],
  ['Talk to Dr Achebe', 8], ['Ask what she makes of you', 8], ['Look at the treble rope', 8], ['Leave the tower', 8],
  ['Go to the quiz at the Plough', 6], ['Listen to the questions', 6], ["Find Dilys's team", 6], ['Leave the quiz', 6],
  ['Find Toby Pike at the old schoolhouse', 7], ['Talk to Toby', 7], ['Ask what his drone saw on Tuesday', 7],
  ['Leave him to his buyers', 7], ['Go to the vicarage', 9],
  ["Read Glenys's email", 9], ['The two went silent', 9], ['The four went silent', 9], ['Jeremy', 9],
  ['Ask Quaile what she thinks', 9], ['Go to bed. Sunday is the service', 10],
  ['Lift the cloth', 10], ['Stand up', 10], ['Name Jeremy Cole', 10], ['Stay for the ringing', 10],
];

const data = JSON.parse(readFileSync(join(repoRoot, 'cozyverse/steeplewyke/ch2/pages.json'), 'utf8'));
// until the voices are recorded (voices.json "recorded": false) the page plays sound only, and the voice checks wait
const voices = JSON.parse(readFileSync(join(repoRoot, 'cozyverse/steeplewyke/ch2/voices.json'), 'utf8'));
const VOICED = voices.recorded !== false;
const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], missing = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || /\[marrow\]/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });

  // every file the ten pages name is there, and every voice take
  const want = [];
  for (const p of data.pages) {
    want.push(`media/sfx/bed-${p.n}.mp3`);
    for (const x of p.panels) {
      want.push(`media/p${p.n}-${x.knot}.jpg`, `media/sfx/p${p.n}-${x.knot}.mp3`);
      for (const b of x.loopSrc || []) want.push(`${b}.webm`, `${b}.mp4`);
      if (x.peek?.src) want.push(`${x.peek.src}.webm`, `${x.peek.src}.mp4`);
    }
  }
  if (VOICED) for (const id of Object.keys(voices.lines))
    for (let k = 1; k <= (voices.takes || 2) + ((voices.secondTake || []).includes(id) ? 1 : 0); k++) want.push(`media/vo/${id}-${k}.mp3`);
  const absent = [];
  for (const f of want) if (!(await page.request.head(BASE + f)).ok()) absent.push(f);
  absent.length ? fail(`files missing (${absent.length}): ${absent.slice(0, 8).join(', ')}`) : pass(`all ${want.length} pictures, loops, sounds and voice takes are present`);

  // the canary is rare: one panel per reading, once. ?canary=brush chooses the brush panel and a 2 s wait
  await page.goto(BASE + '?canary=brush');
  await page.waitForSelector('#go-sound:not([disabled])');
  await page.click('#go-sound');
  if (VOICED) await page.waitForFunction(() => window.__plainhunt.page === 1 && (window.__plainhunt.playing || '').includes('/vo/p1-open-'), null, { timeout: 15000 })
    .then(() => pass('Begin with sound: page 1, the opening line plays')).catch(() => fail('the opening line did not play'));
  else await page.waitForFunction(() => window.__plainhunt.page === 1 && window.__plainhunt.bed === 'media/sfx/bed-1.mp3' && !window.__plainhunt.voiced, null, { timeout: 15000 })
    .then(() => pass('Begin with sound: page 1 and its sound bed (voices not recorded yet: none asked for)')).catch(() => fail('page 1 did not start'));

  const shot = async (n) => { if (process.env.SHOTS) { await wait(1500); await page.screenshot({ path: `${process.env.SHOTS}/page${String(n).padStart(2, '0')}.png` }); } };
  await shot(1);
  let quiet = [], pageWrong = [], bedWrong = [], small = 0, seenPages = new Set([1]), memSeen = null;
  for (const [label, n] of PATH) {
    const ok = await page.waitForFunction((t) => [...document.querySelectorAll('.ink .choice')].some((b) => b.textContent === t), label, { timeout: 15000 }).then(() => true, () => false);
    if (!ok) { fail(`no choice "${label}"; offered: ${await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].map((b) => b.textContent).join(' | '))}`); break; }
    small += await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].filter((b) => b.getBoundingClientRect().height < 44).length);
    await page.evaluate((t) => [...document.querySelectorAll('.ink .choice')].find((b) => b.textContent === t).click(), label);
    if (VOICED) await page.waitForFunction(() => (window.__plainhunt.playing || '').includes('/vo/'), null, { timeout: 10000 }).catch(() => quiet.push(label));
    else await wait(250);
    const st = await page.evaluate(() => ({ page: window.__plainhunt.page, bed: window.__plainhunt.bed, sections: document.querySelectorAll('#page > section').length }));
    if (st.page !== n || st.sections !== 4) pageWrong.push(`${label}: page ${st.page}, ${st.sections} panels`);
    if (st.bed !== `media/sfx/bed-${n}.mp3`) bedWrong.push(`${label}: ${st.bed}`);
    if (!memSeen) memSeen = await page.evaluate(() => window.__plainhunt.memory);
    // the barn's brush panel holds its still and shows the canary every few seconds
    if (label === 'Look at the trestle at the back') {
      await page.waitForFunction(() => document.getElementById('brush')?.classList.contains('peeking') || window.__plainhunt.canary.done, null, { timeout: 12000 })
        .then(() => pass('the brush panel shows the canary (two seconds after the page, as ?canary=brush asks)'))
        .catch(async () => fail(`no peek on the brush panel (data-loops ${await page.evaluate(() => document.getElementById('brush')?.dataset.loops)})`));
      await page.waitForFunction(() => { const s = document.getElementById('brush'), v = s?.querySelector('video');
        return s && !s.classList.contains('peeking') && v.paused && v.currentTime === 0; }, null, { timeout: 6000 })
        .then(() => pass('the peek ends and the panel holds its still again'))
        .catch(() => fail('the peek did not end'));
    }
    // the canary was given to the brush panel: the other canary panels are plain stills this reading
    if (label === 'Ask what his drone saw on Tuesday') {
      const school = await page.evaluate(() => ({ video: !!document.querySelector('#school video'), canary: window.__plainhunt.canary }));
      !school.video && school.canary.done && school.canary.panel === 'brush' ? pass('the canary showed once, on one panel; the schoolhouse is a still this reading')
        : fail(`canary: ${JSON.stringify(school)}`);
    }
    // a short loop plays on the fire, and a looping panel has no vignette
    if (label === 'Listen to the questions') {
      const fire = await page.evaluate(() => { const s = document.getElementById('fire'); const v = [...s.querySelectorAll('video')].find((x) => x.style.opacity === '1');
        return { playing: !!v && !v.paused, shade: getComputedStyle(s, '::after').boxShadow !== 'none' }; });
      fire.playing && !fire.shade ? pass('the fire panel plays its short loop, with no vignette') : fail(`fire: ${JSON.stringify(fire)}`);
    }
    if (label === "Read Glenys's email") {
      const t = await page.evaluate(() => document.querySelector('.ink').textContent);
      /2 4 1 3/.test(t) && /4 3 2 1/.test(t) ? pass("Glenys's three rows are on the page") : fail('the rows are not shown');
    }
    if (!seenPages.has(n)) { seenPages.add(n); await shot(n); }
  }
  if (VOICED) quiet.length ? fail(`no voice after: ${quiet.join('; ')}`) : pass(`a voice take plays after each of the ${PATH.length} choices`);
  else console.log('- voices not recorded yet (voices.json "recorded": false): voice checks skipped');
  pageWrong.length ? fail(`wrong page: ${pageWrong.join('; ')}`) : pass(`${seenPages.size} pages turned in the order this route takes, four panels each (${[...seenPages].join(', ')})`);
  bedWrong.length ? fail(`wrong bed: ${bedWrong.join('; ')}`) : pass('each page plays its own sound bed');
  small ? fail(`${small} choice buttons under 44 px`) : pass('every choice button is at least 44 px tall');

  const end = await page.evaluate(() => ({ text: document.querySelector('.ink').textContent, ending: window.__plainhunt.story.variablesState.ending,
    named4: window.__plainhunt.story.variablesState.named4, evidence: window.__plainhunt.story.EvaluateFunction('evidence') }));
  end.ending === 'solved' && end.named4 && /You solved Plain Hunt/.test(end.text) && end.evidence >= 5
    ? pass(`the ending says the case is solved (the silent bell found, evidence ${end.evidence} of 11)`) : fail(`ending: ${JSON.stringify(end)}`);

  const vil = await page.evaluate(() => window.__plainhunt.village);
  vil.achebe === 1 && vil.quaile === 1 ? pass('the village remembers: Dr Achebe +1 and Quaile +1 saved in this browser') : fail(`village after the reading: ${JSON.stringify(vil)}`);
  memSeen ? pass(`a memory notice showed: "${memSeen}"`) : fail('no memory notice showed');

  // Begin again, then a tap into a panel: the story follows the tap and that panel's own sound comes in over the bed
  await page.evaluate(() => [...document.querySelectorAll('.ink .choice')].find((b) => b.textContent === 'Begin again').click());
  await page.waitForFunction(() => window.__plainhunt.page === 1 && window.__plainhunt.story.variablesState.visits === 0 && window.__plainhunt.story.variablesState.rows === false, null, { timeout: 10000 })
    .then(() => pass('Begin again goes back to page 1 with no clues')).catch(() => fail('Begin again did not reset'));
  const was = await page.evaluate(() => [window.__plainhunt.story.variablesState.was_achebe, window.__plainhunt.story.variablesState.was_quaile]);
  was[0] === 1 && was[1] === 1 ? pass('the next reading starts from what the village remembers') : fail(`next reading: was achebe, quaile ${was}`);
  await wait(1200);
  const box = await page.evaluate(() => { const r = document.getElementById('tower').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(() => window.__plainhunt.panelSound === 'media/sfx/p1-tower.mp3' && /Rooks go round the spire/.test(document.querySelector('.ink').textContent), null, { timeout: 10000 })
    .then(() => pass('a tap on the tower panel takes the story there and brings in its sound'))
    .catch(async () => fail(`tap: ${JSON.stringify(await page.evaluate(() => ({ s: window.__plainhunt.panelSound, t: document.querySelector('.ink').textContent.slice(0, 80) })))}`));
  // the rooks loop over the tower (two takes, cross-faded); a still such as Dr Achebe's panel has a vignette
  const marks = await page.evaluate(() => { const t = document.getElementById('tower'), a = document.getElementById('achebe');
    return { loops: t.dataset.loops, playing: [...t.querySelectorAll('video')].some((v) => !v.paused), towerShade: getComputedStyle(t, '::after').boxShadow !== 'none',
      stillShade: getComputedStyle(a, '::after').boxShadow !== 'none' }; });
  marks.loops === '2' && marks.playing && !marks.towerShade && marks.stillShade
    ? pass('the rooks loop on the tower panel (two takes); a still panel has a vignette') : fail(`tower/still: ${JSON.stringify(marks)}`);
  // a double tap counts as one tap (wait first: two taps within 350 ms are one double tap)
  await wait(600);
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(() => document.getElementById('page').current === -1, null, { timeout: 5000 }).catch(() => {});
  await wait(1600);
  const ach = await page.evaluate(() => { const r = document.getElementById('achebe').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.dblclick(ach.x, ach.y);
  await wait(1800);
  const dbl = await page.evaluate(() => { const p = document.getElementById('page'); return p.current >= 0 ? p.panels[p.current].id : 'overview'; });
  dbl === 'achebe' ? pass('a double tap on a panel goes into it, as one tap does') : fail(`after a double tap the view is on ${dbl}`);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  sideways > 1 ? fail(`sideways scroll ${sideways} px`) : pass('no sideways scroll at 390 px');
  missing.length ? fail(`failed requests: ${missing.slice(0, 6).join(', ')}`) : pass('no failed requests');
  errors.length ? fail('errors: ' + errors.slice(0, 4).join(' | ')) : pass('no page errors');
} finally { await browser.close(); server.kill(); }
console.log(failed ? '\nPLAIN HUNT: FAIL' : '\nPLAIN HUNT: PASS');
process.exit(failed ? 1 : 0);
