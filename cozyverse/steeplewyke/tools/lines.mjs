// Every voiced line of marrow.ink, from the real ink compiler and Story API (no text parsing of the ink).
// Visits each knot under many mixes of: every clue true or false, which places were seen, each ending, and the
// first/middle/last visit, so the lines inside conditional blocks are found too. Prints JSON: { "<voice id>": { "speaker": "...", "text": "..." } }.
//   node cozyverse/steeplewyke/tools/lines.mjs [--check cozyverse/steeplewyke/v2/voices.json]   (STORY=. for version 1)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const inkjs = createRequire(import.meta.url)('inkjs/full');
// the story folder: v2 unless STORY names another (STORY=. for the first version)
const story = join(here, '..', process.env.STORY || 'v2');
const src = readFileSync(join(story, 'marrow.ink'), 'utf8');
const json = new inkjs.Compiler(src).Compile().ToJson();
const CLUES = ['flask', 'green', 'foxglove', 'notebook', 'syringe', 'alibi', 'poured', 'argument', 'clement_study', 'rattled', 'toby_vicar'];
const SEEN = ['seen_margaret', 'seen_tent', 'seen_carpark', 'seen_vicarage', 'seen_study'];
// which places count as seen: none, all, each one alone, and all but each one
const SEEN_SETS = [[], SEEN, ...SEEN.map((x) => [x]), ...SEEN.map((x) => SEEN.filter((y) => y !== x))];
const MIXES = [];
for (const on of [true, false]) for (const seen of SEEN_SETS) for (const ending of ['solved', 'quaile', 'denied', 'none', ''])
  for (const visits of [0, 1, 3]) MIXES.push({ on, seen, ending, visits });
const probe = new inkjs.Story(json);
const knots = [...probe.mainContentContainer.namedContent.keys()].filter((k) => !k.startsWith('global') && k !== 'evidence');
const out = {};
for (const knot of knots) for (const { on, seen, ending, visits } of MIXES) {
  const s = new inkjs.Story(json);
  for (const c of CLUES) s.variablesState[c] = on;
  for (const c of SEEN) s.variablesState[c] = seen.includes(c);
  s.variablesState.ending = ending; s.variablesState.visits = visits;
  // what the village thought before this reading: warm on the all-true mixes, cold on the all-false ones
  for (const who of ['toby', 'margaret', 'dilys', 'quaile']) s.variablesState[`was_${who}`] = on ? 1 : -1;
  s.ChoosePathString(knot);
  // a forced mix can be a state no reading reaches (every place seen after one visit): stop there quietly
  s.onError = () => {};
  while (s.canContinue) {
    let line;
    try { line = s.Continue().trim(); } catch { break; }
    for (const t of s.currentTags) {
      const id = /^voice\s*:\s*([\w-]+)$/.exec(t.trim())?.[1];
      if (!id) continue;
      const who = /^([A-Z][a-z]+): /.exec(line);
      out[id] = { speaker: who ? who[1].toLowerCase() : 'narrator', text: who ? line.slice(who[0].length) : line };
    }
  }
}
const i = process.argv.indexOf('--check');
if (i > 0) {
  const want = JSON.parse(readFileSync(process.argv[i + 1], 'utf8')).lines;
  const bad = Object.keys(out).filter((k) => !want[k] || want[k].text !== out[k].text || want[k].speaker !== out[k].speaker);
  const extra = Object.keys(want).filter((k) => !out[k]);
  if (bad.length || extra.length) { console.error('voices.json is out of step with marrow.ink:', { bad, extra }); process.exit(1); }
  console.log(`voices.json matches marrow.ink: ${Object.keys(out).length} lines`);
} else console.log(JSON.stringify(out, null, 1));
