// Random readings of a chapter's ink (marrow.ink, plainhunt.ink) with the real compiler and Story API: finds dead ends (no choice and no END) and
// shows how much the routes differ (endings, order of places, evidence). A quarter of its moves are TAPS, as a reader
// makes them: a jump to a panel of the current page, or back to the page (pages.json), as novel-page does.   node cozyverse/steeplewyke/tools/walk.mjs [runs]
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const inkjs = createRequire(import.meta.url)('inkjs/full');
const here = dirname(fileURLToPath(import.meta.url));
// the story folder (STORY=ch2; default v2) and its one .ink file
const dir = join(here, '..', process.env.STORY || 'v2');
const json = new inkjs.Compiler(readFileSync(join(dir, process.env.INK || readdirSync(dir).find((f) => /^[^.]+\.ink$/.test(f))), 'utf8')).Compile().ToJson();
const runs = +process.argv[2] || 2000;
const pages = JSON.parse(readFileSync(join(dir, 'pages.json'), 'utf8')).pages;
const taps = Object.fromEntries(pages.map((p) => [p.n, [`p${p.n}`, ...p.panels.map((x) => x.ink)]]));
let tapsMade = 0;
const endings = {}, routes = new Set(), texts = new Set(), evid = {};
let stuck = 0;
const stuckAt = {};
const again = {};     // a choice offered again after the reader has already taken it in this reading   // the move before a dead end: a choice text or a tapped knot
for (let r = 0; r < runs; r++) {
  const s = new inkjs.Story(json);
  let route = [], seen = '', steps = 0, here = 1, lastMove = 'start';
  const taken = new Set();
  for (;;) {
    let l;
    while (s.canContinue) { try { l = s.Continue(); } catch (e) { stuckAt[lastMove] = (stuckAt[lastMove] || 0) + 1; break; } seen += l; for (const t of s.currentTags) { const m = /^page:\s*(\d+)/.exec(t); if (m) { here = +m[1]; if (route.at(-1) !== m[1]) route.push(m[1]); } } }
    const ch = s.currentChoices;
    if (!ch.length) { stuck++; stuckAt[lastMove] = (stuckAt[lastMove] || 0) + 1; break; }  // the only way out is "Begin again", below
    if (ch.some((c) => c.text === 'Begin again')) break;
    if (++steps > 400) { stuck++; break; }
    if (Math.random() < 0.25) { const t = taps[here]; lastMove = 'tap ' + t[Math.floor(Math.random() * t.length)]; s.ChoosePathString(lastMove.slice(4)); tapsMade++; continue; }
    for (const c of ch) if (taken.has(c.text)) again[c.text] = (again[c.text] || 0) + 1;
    const pick = Math.floor(Math.random() * ch.length); lastMove = ch[pick].text; taken.add(lastMove); s.ChooseChoiceIndex(pick);
  }
  const e = s.variablesState.ending; endings[e] = (endings[e] || 0) + 1;
  const n = s.EvaluateFunction('evidence'); evid[n] = (evid[n] || 0) + 1;
  routes.add(route.join(' ')); texts.add(seen);
}
const offeredAgain = Object.fromEntries(Object.entries(again).sort((a, b) => b[1] - a[1]).slice(0, 25));
console.log({ runs, taps: tapsMade, stuck, stuckAt, offeredAgain, endings, evidence: evid, distinctPageOrders: routes.size, distinctTexts: texts.size });
process.exit(stuck ? 1 : 0);
