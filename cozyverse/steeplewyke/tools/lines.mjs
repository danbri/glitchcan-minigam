// Every voiced line of a chapter's ink, from the real ink compiler and Story API (no text parsing of the ink).
// Visits each knot under many mixes of: every clue true or false, which places were seen, each ending, and the
// first/middle/last visit, so the lines inside conditional blocks are found too. Prints JSON: { "<voice id>": { "speaker": "...", "text": "..." } }.
//   node cozyverse/steeplewyke/tools/lines.mjs [--check cozyverse/steeplewyke/v2/voices.json]   (STORY=. for version 1)
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const inkjs = createRequire(import.meta.url)('inkjs/full');
// the story folder: v2 unless STORY names another (STORY=. for the first version)
const story = join(here, '..', process.env.STORY || 'v2');
const src = readFileSync(join(story, process.env.INK || readdirSync(story).find((f) => /^[^.]+\.ink$/.test(f))), 'utf8');
const json = new inkjs.Compiler(src).Compile().ToJson();
const compiled = JSON.parse(json);  // parsed once: a Story made from the object skips re-reading the JSON text
// the story's own variables, from the Story API: every true/false one is a clue (seen_ ones are places), was_ ones are
// what the village thought before this reading
const vars = new inkjs.Story(compiled).variablesState;
const names = [...vars._globalVariables.keys()];
const SEEN = names.filter((n) => n.startsWith('seen_') && typeof vars[n] === 'boolean');
const CLUES = names.filter((n) => !n.startsWith('seen_') && typeof vars[n] === 'boolean');
const WAS = names.filter((n) => n.startsWith('was_'));
// which places count as seen: none, all, each one alone, and all but each one
const SEEN_SETS = [[], SEEN, ...SEEN.map((x) => [x]), ...SEEN.map((x) => SEEN.filter((y) => y !== x))];
const MIXES = [];
for (const on of [true, false]) for (const seen of SEEN_SETS) for (const ending of ['solved', 'quaile', 'denied', 'none', ''])
  for (const visits of [0, 1, 3]) MIXES.push({ on, seen, ending, visits });
// lines that need some clues and not others (Dilys asked but no email yet): 300 fixed random mixes, the same every run
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let i = 0; i < 300; i++) MIXES.push({ on: Object.fromEntries(CLUES.map((c) => [c, rnd() < 0.5])), seen: SEEN.filter(() => rnd() < 0.5), ending: '', visits: 1 });
const probe = new inkjs.Story(compiled);
const top = [...probe.mainContentContainer.namedContent.keys()].filter((k) => !k.startsWith('global') && k !== 'evidence');
// stitches too (a story that diverts to "knot.stitch" never passes the knot's own start)
const knots = top.flatMap((k) => [k, ...[...(probe.mainContentContainer.namedContent.get(k)?.namedContent?.keys() || [])].map((st) => `${k}.${st}`)]);
// Lock Fourteen guards every panel knot with the page being visited ("at") and keys scenes to the day: when a story
// has those variables, set "at" from the knot's page number (pN...) and try each day
const AT = names.includes('at'), DAYS = names.includes('day') ? [1, 2, 3, 4] : [null];
const out = {};
for (const knot of knots) for (const day of DAYS) for (const { on, seen, ending, visits } of MIXES) {
  const s = new inkjs.Story(compiled);
  if (AT) s.variablesState.at = +(/^p(\d+)/.exec(knot)?.[1] ?? 8);
  if (day !== null) s.variablesState.day = day;
  for (const c of CLUES) s.variablesState[c] = typeof on === 'object' ? on[c] : on;
  for (const c of SEEN) s.variablesState[c] = seen.includes(c);
  s.variablesState.ending = ending; s.variablesState.visits = visits;
  // what the village thought before this reading: warm on the all-true mixes, cold on the all-false ones
  for (const w of WAS) s.variablesState[w] = on === false ? -1 : 1;
  for (let pass = 0; pass < 2; pass++) {
    try { s.ChoosePathString(knot); } catch { break; }
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
}
// a scene visited again says something shorter (pN > 1, a conversation revisited): visit each knot three times
for (const knot of knots) {
  const s = new inkjs.Story(compiled);
  if (AT) s.variablesState.at = +(/^p(\d+)/.exec(knot)?.[1] ?? 8);
  s.onError = () => {};
  for (let n = 0; n < 3; n++) {
    try { s.ChoosePathString(knot); } catch { break; }
    while (s.canContinue) {
      let line;
      try { line = s.Continue().trim(); } catch { break; }
      for (const t of s.currentTags) {
        const id = /^voice\s*:\s*([\w-]+)$/.exec(t.trim())?.[1];
        if (!id || out[id]) continue;
        const who = /^([A-Z][a-z]+): /.exec(line);
        out[id] = { speaker: who ? who[1].toLowerCase() : 'narrator', text: who ? line.slice(who[0].length) : line };
      }
    }
  }
}
// states the mixes above never make (a string such as r_whom == "vandams"): a story may list them in lines-states.json,
// each an object of variable values, and every knot is visited once under each
let states = [];
try { states = JSON.parse(readFileSync(join(story, 'lines-states.json'), 'utf8')); } catch { /* none */ }
for (const st of states) for (const knot of knots) {
  const s = new inkjs.Story(compiled);
  s.onError = () => {};
  if (AT) s.variablesState.at = +(/^p(\d+)/.exec(knot)?.[1] ?? 8);
  for (const [k, v] of Object.entries(st)) s.variablesState[k] = v;
  try { s.ChoosePathString(knot); } catch { continue; }
  while (s.canContinue) {
    let line;
    try { line = s.Continue().trim(); } catch { break; }
    for (const t of s.currentTags) {
      const id = /^voice\s*:\s*([\w-]+)$/.exec(t.trim())?.[1];
      if (!id || out[id]) continue;
      const who = /^([A-Z][a-z]+): /.exec(line);
      out[id] = { speaker: who ? who[1].toLowerCase() : 'narrator', text: who ? line.slice(who[0].length) : line };
    }
  }
}
// every voice tag the compiler emitted must have been reached (inkjs writes a tag as "#", "^voice: id", "/#")
const tagged = new Set();
(function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  else if (typeof o === 'string') { const id = /^\^voice\s*:\s*([\w-]+)$/.exec(o.trim())?.[1]; if (id) tagged.add(id); } })(JSON.parse(json));
if (!tagged.size) { console.error('found no voice tags in the compiled story: the tag format has changed'); process.exit(2); }
const unreached = [...tagged].filter((id) => !out[id]);
if (unreached.length) { console.error('voice tags never reached:', unreached); process.exit(2); }
const i = process.argv.indexOf('--check');
if (i > 0) {
  const want = JSON.parse(readFileSync(process.argv[i + 1], 'utf8')).lines;
  const bad = Object.keys(out).filter((k) => !want[k] || want[k].text !== out[k].text || want[k].speaker !== out[k].speaker);
  const extra = Object.keys(want).filter((k) => !out[k]);
  if (bad.length || extra.length) { console.error('voices.json is out of step with marrow.ink:', { bad, extra }); process.exit(1); }
  console.log(`voices.json matches marrow.ink: ${Object.keys(out).length} lines`);
} else console.log(JSON.stringify(out, null, 1));
