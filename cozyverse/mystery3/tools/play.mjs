// A stateless command-line reader for lockfourteen.ink: replays the moves given, then prints what the LAST move
// produced, the numbered choices, and the panels of the page in view that a reader could tap (pages.json).
// Moves: a number picks that choice (1-based); t:<knot> taps a panel.
//   node cozyverse/mystery3/tools/play.mjs            the opening
//   node cozyverse/mystery3/tools/play.mjs 1 2 t:p1_bag 3
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const inkjs = createRequire(import.meta.url)('inkjs/full');
const here = dirname(fileURLToPath(import.meta.url));
const json = new inkjs.Compiler(readFileSync(join(here, '..', 'lockfourteen.ink'), 'utf8')).Compile().ToJson();
const pages = JSON.parse(readFileSync(join(here, '..', 'pages.json'), 'utf8')).pages;
const s = new inkjs.Story(json);
let page = 1, last = '';
const run = () => {
  let t = '';
  while (s.canContinue) {
    t += s.Continue();
    for (const tag of s.currentTags) { const m = /^page:\s*(\d+)/.exec(tag); if (m) page = +m[1]; }
  }
  return t;
};
last = run();
for (const [i, mv] of process.argv.slice(2).entries()) {
  if (mv.startsWith('t:')) {
    const p = pages.find((x) => x.n === page);
    if (!p || !p.panels.some((x) => x.ink === mv.slice(2))) { console.log(`move ${i + 1}: ${mv} is not a panel of page ${page}`); process.exit(1); }
    s.ChoosePathString(mv.slice(2));
  } else {
    const k = +mv - 1;
    if (!(k >= 0 && k < s.currentChoices.length)) { console.log(`move ${i + 1}: no choice ${mv}`); process.exit(1); }
    s.ChooseChoiceIndex(k);
  }
  last = run();
}
console.log(last.trim());
console.log('');
s.currentChoices.forEach((c, i) => console.log(`${i + 1}. ${c.text}`));
const p = pages.find((x) => x.n === page);
if (p && s.currentChoices.length) console.log(`(page ${page}, ${p.title}; tap: ${p.panels.map((x) => 't:' + x.ink).join(' ')})`);
