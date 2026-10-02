// Every voiced line of marrow.ink, from the real ink compiler and Story API (no text parsing of the ink).
// Visits each knot twice, once with every clue true and once with every clue false, so the lines inside
// {clue: ...} blocks are found too. Prints JSON: { "<voice id>": { "speaker": "...", "text": "..." } }.
//   node cozyverse/steeplewyke/tools/lines.mjs [--check voices.json]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const inkjs = createRequire(import.meta.url)('inkjs/full');
const src = readFileSync(join(here, '..', 'marrow.ink'), 'utf8');
const json = new inkjs.Compiler(src).Compile().ToJson();
const CLUES = ['flask', 'green', 'foxglove', 'notebook', 'syringe', 'alibi'];
const probe = new inkjs.Story(json);
const knots = [...probe.mainContentContainer.namedContent.keys()].filter((k) => !k.startsWith('global'));
const out = {};
for (const knot of knots) for (const on of [true, false]) {
  const s = new inkjs.Story(json);
  for (const c of CLUES) s.variablesState[c] = on;
  s.ChoosePathString(knot);
  while (s.canContinue) {
    const line = s.Continue().trim();
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
