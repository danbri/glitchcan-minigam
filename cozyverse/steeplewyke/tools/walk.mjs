// Random readings of marrow.ink with the real compiler and Story API: finds dead ends (no choice and no END) and
// shows how much the routes differ (endings, order of places, evidence).   node cozyverse/steeplewyke/tools/walk.mjs [runs]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const inkjs = createRequire(import.meta.url)('inkjs/full');
const here = dirname(fileURLToPath(import.meta.url));
const json = new inkjs.Compiler(readFileSync(join(here, '..', 'marrow.ink'), 'utf8')).Compile().ToJson();
const runs = +process.argv[2] || 2000;
const endings = {}, routes = new Set(), texts = new Set(), evid = {};
let stuck = 0;
for (let r = 0; r < runs; r++) {
  const s = new inkjs.Story(json);
  let route = [], seen = '', steps = 0;
  for (;;) {
    while (s.canContinue) { const l = s.Continue(); seen += l; for (const t of s.currentTags) { const m = /^page:\s*(\d+)/.exec(t); if (m && route.at(-1) !== m[1]) route.push(m[1]); } }
    const ch = s.currentChoices;
    if (!ch.length) { if (!s.canContinue && !/You solved|solved the|without enough|Nobody was charged/.test(seen)) stuck++; break; }
    if (ch.some((c) => c.text === 'Begin again')) break;
    if (++steps > 200) { stuck++; break; }
    s.ChooseChoiceIndex(Math.floor(Math.random() * ch.length));
  }
  const e = s.variablesState.ending; endings[e] = (endings[e] || 0) + 1;
  const n = s.EvaluateFunction('evidence'); evid[n] = (evid[n] || 0) + 1;
  routes.add(route.join(' ')); texts.add(seen);
}
console.log({ runs, stuck, endings, evidence: evid, distinctPageOrders: routes.size, distinctTexts: texts.size });
process.exit(stuck ? 1 : 0);
