// Random readings of marrow.ink with the real compiler and Story API: finds dead ends (no choice and no END) and
// shows how much the routes differ (endings, order of places, evidence). A quarter of its moves are TAPS, as a reader
// makes them: a jump to a panel of the current page, or back to the page (pages.json), as novel-page does.   node cozyverse/steeplewyke/tools/walk.mjs [runs]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const inkjs = createRequire(import.meta.url)('inkjs/full');
const here = dirname(fileURLToPath(import.meta.url));
const json = new inkjs.Compiler(readFileSync(join(here, '..', process.env.STORY || 'v2', 'marrow.ink'), 'utf8')).Compile().ToJson();
const runs = +process.argv[2] || 2000;
const pages = JSON.parse(readFileSync(join(here, '..', process.env.STORY || 'v2', 'pages.json'), 'utf8')).pages;
const taps = Object.fromEntries(pages.map((p) => [p.n, [`p${p.n}`, ...p.panels.map((x) => x.ink)]]));
let tapsMade = 0;
const endings = {}, routes = new Set(), texts = new Set(), evid = {};
let stuck = 0;
for (let r = 0; r < runs; r++) {
  const s = new inkjs.Story(json);
  let route = [], seen = '', steps = 0, here = 1;
  for (;;) {
    while (s.canContinue) { const l = s.Continue(); seen += l; for (const t of s.currentTags) { const m = /^page:\s*(\d+)/.exec(t); if (m) { here = +m[1]; if (route.at(-1) !== m[1]) route.push(m[1]); } } }
    const ch = s.currentChoices;
    if (!ch.length) { if (!s.canContinue && !/You solved|solved the|without enough|Nobody was charged/.test(seen)) stuck++; break; }
    if (ch.some((c) => c.text === 'Begin again')) break;
    if (++steps > 400) { stuck++; break; }
    if (Math.random() < 0.25) { const t = taps[here]; s.ChoosePathString(t[Math.floor(Math.random() * t.length)]); tapsMade++; continue; }
    s.ChooseChoiceIndex(Math.floor(Math.random() * ch.length));
  }
  const e = s.variablesState.ending; endings[e] = (endings[e] || 0) + 1;
  const n = s.EvaluateFunction('evidence'); evid[n] = (evid[n] || 0) + 1;
  routes.add(route.join(' ')); texts.add(seen);
}
console.log({ runs, taps: tapsMade, stuck, endings, evidence: evid, distinctPageOrders: routes.size, distinctTexts: texts.size });
process.exit(stuck ? 1 : 0);
