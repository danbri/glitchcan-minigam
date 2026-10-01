// Word scan for the nocliches-fink-authoring skill: where in our .fink.js stories the banned words and phrases of
// "BANNED: The Definitive Guide" appear (SKILL.md in this folder; the rule ids are the guide's section numbers).
//   node .claude/skills/nocliches-fink-authoring/scan.mjs [file.fink.js ...]   (default: every tracked .fink.js)
//   JSON=1 for machine-readable output
// Each file is read with the real capture code (packages/backticks extractBlocks), so only the ink inside
// the sigils is looked at. Each ink line is then searched for trigger words the way grep would; the ink structure
// is not interpreted (CLAUDE.md, NO HACKPARSING). A hit is a place for a person to look, not a verdict.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBlocks } from '../../../packages/backticks/src/node.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : execFileSync('git', ['ls-files', '*.fink.js'], { cwd: root, encoding: 'utf8' }).trim().split('\n').map((f) => join(root, f));

// [rule id, label, pattern]; word boundaries, case-insensitive
const RULES = [
  ['1.1', '", then" between actions', /, then\b/i],
  ['1.2', '"something" + verb', /\bsomething (shifts?|shifted|tightens?|flickers?|hardens?|breaks?|cracks?|loosens?|changes?|stirs?|moves?|settles?)\b/i],
  ['1.3', 'silence as an actor', /\bsilence (stretch|sits|sat|hangs|hung|grows|grew|presses|pressed|falls|fell|settles|settled)/i],
  ['1.4', '"not X, but Y"', /\bnot [\w' -]{1,30}, but\b/i],
  ['1.9', '"isn\'t quite"', /\b(isn't|wasn't) (quite|really) /i],
  ['1.12', 'story mechanics in narration', /\b(the scene|this scene|the next beat|the real moment)\b/i],
  ['1.14', 'attraction as physics', /\b(pulled toward|drawn to|orbits? around|the gravity between|magnetic)\b/i],
  ['1.15', '"hangs in the air"', /\bhangs? (in the air|between)\b/i],
  ['1.16', 'impact simile', /\blike a (blow|punch|freight train|slap)\b|knocked the air/i],
  ['1.17', 'ripple / stillness simile', /\blike a stone\b|\brippled? through\b|stillness shattered/i],
  ['1.18', 'precision cluster', /\b(surgical|practi[cs]ed ease|economical movement|calculated|calibrated|methodical|clinical|exacting|meticulous)\b/i],
  ['1.19', 'texture default', /\b(velvet|silk|steel|iron|granite|marble)\b/i],
  ['1.21', 'communication by proxy', /\b(a look that said|didn't need words|spoke volumes|said it all|said everything)\b/i],
  ['1.22', 'hollow restraint', /\b(held it together|swallowed it down|kept it inside|bottled it up|locked it away)\b/i],
  ['1.25', 'epic tone', /\b(changed everything|broke forever|held its breath|nothing would ever be the same|everything had changed)\b/i],
  ['1.27', '"from X to Y"', /\bfrom (the )?\w+ to (the )?\w+/i],
  ['1.28', 'interpreting participle', /, (highlighting|underscoring|reflecting|emphasi[sz]ing|showcasing|symboli[sz]ing|illustrating|demonstrating)\b/i],
  ['1.29', 'negative parallelism', /\bnot only\b|\bit'?s not about\b|\bwasn't just\b|\bdidn't just\b/i],
  ['1.30', '"with the [noun] of someone"', /\bwith the \w+ of (someone|somebody|a man|a woman)\b/i],
  ['2.1', 'physical tell', /\b(jaw (tighten|clench|set|lock|work)|throat (work|bob)|swallows? (hard|thickly)|breath (catch|hitch|stutter)|exhales? (slowly|shakily)|didn't know (he|she|you) (was|were) holding|eyes (darken|go dark)|gaze (sharpen|harden|soften)|knuckles whiten|hands? curl|goes very still|heart (stutter|pound|race)|chest (tighten|ache))/i],
  ['2.2', 'vague interiority', /\b(the weight of|a wave of|the air (thickens|shifts|changes)|the room feels smaller|feels? it in (his|her|your) bones|something unnameable)\b/i],
  ['2.3', 'intensity default', /\b(raw|visceral|primal|bone-deep|soul-deep|paper-thin|razor-thin|frayed edges|worn thin)\b/i],
  ['2.4', 'beat placeholder', /\b(for a (long )?moment|for a beat|after a moment|a pause, then|finally)\b/i],
  ['2.5', 'dialogue-tag adverb / voice', /\b(said|says|asked|asks) (softly|quietly|carefully|slowly|flatly|evenly|roughly)\b|\bvoice (drops|tightens|goes flat|breaks|hardens|softens)\b|barely above a whisper|falsely casual/i],
  ['2.6', 'gaze word', /\b(assessing|appraising|cataloguing|watchful|shuttered|unreadable|inscrutable)\b/i],
  ['2.8', 'competence words', /\b(effortless|seamless|graceful economy|quiet competence|easy confidence|contained power|coiled energy)\b/i],
  ['2.10', 'temperature as emotion', /\b(cold (voice|gaze|eyes|tone)|blood ran cold|ice in (his|her|your) veins|warmth spread|heat pooled)\b/i],
  ['2.13', 'breaking metaphor', /\b(cracked open|split (him|her|you) open|shattered something|fault lines|hairline fracture)\b/i],
  ['2.14', 'anchor / tether metaphor', /\b(anchored|tethered|grounded|moored|rooted|was (his|her|your) anchor)\b/i],
  ['2.15', 'edge metaphor', /\b(on the edge of|teetering|precipice|hanging by a thread|barely holding on)\b/i],
  ['2.16', 'silence phrase', /\b(deafening silence|silence roared|the quiet pressed|swallowed by the quiet)\b/i],
  ['2.17', 'time / moment phrase', /\b(time stretched|moment crystalli[sz]ed|suspended in amber|frozen in place|the world narrowed|everything else fell away)\b/i],
  ['2.18', 'permission construction', /\b(allowed|let) (himself|herself|yourself|themselves) (to )?\w+/i],
  ['2.19', 'realisation phrase', /\b(clicked into place|pieces slotted|understanding dawned|clarity crashed)\b/i],
  ['2.20', 'threat descriptor', /\b(lethal grace|predatory|coiled to strike|dangerous edge|quiet menace|promise of violence)\b/i],
  ['2.21', 'presence phrase', /\b(commanded the room|filled the space|sucked the air|impossible to ignore)\b/i],
  ['2.22', 'intimacy phrase', /\b(the space between (them|us)|closed the distance|got under (his|her|your) skin)\b/i],
  ['2.25', 'transition verb alone', /\b(shifted|flickered|softened|hardened|gentled)\b/i],
  ['2.26', 'stock banter', /\byou're (such a menace|impossible|trouble|the worst|insufferable|ridiculous)\b|death of me/i],
  ['2.27', 'cinematic wallpaper', /\b(light (spills|pools|catches)|shadows play|the skyline stretches|floor-to-ceiling|in sharp relief|neon glow|the city hummed)\b/i],
  ['2.28', 'description cliché', /\b(orbs|alabaster|porcelain|mane|broad shoulders|lean muscle)\b/i],
  ['2.30', 'religious exclamation', /\b(oh (my )?god|jesus|christ)\b/i],
  ['2.31', 'ending cliché', /\b(that was enough|it was a start|figure it out\. somehow)\b/i],
  ['2.32', 'pseudo-analysis', /\b(cut through the noise|sliced through|pierced through|wormed its way|the (architecture|geometry|calculus|mathematics|grammar) of)\b/i],
  ['2.33', 'AI vocabulary', /\b(tapestry|landscape|interplay|intricac(y|ies)|nuanced?|multifaceted|dynamics|paradigm|delv(e|es|ing)|foster(s|ing)?|garner(s|ed|ing)?|underscor(e|es|ing)|showcas(e|es|ing)|pivotal|crucial|vital|vibrant|intricate|profound|compelling|poignant|evocative|palpable|seemingly|arguably|notably|importantly|ultimately|fundamentally|inherently|undeniably)\b/i],
  ['2.35', 'puffery', /\b(a testament to|serves as a reminder|enduring legacy|lasting (legacy|impact)|indelible|plays? a (vital|pivotal|crucial|key) role|cannot be overstated)\b/i],
  ['2.36', 'brochure language', /\b(nestled|in the heart of|boasts? a|stunning|breathtaking|bustling|picturesque|idyllic|continues to captivate)\b/i],
  ['2.37', 'familiarity word', /\b(familiar|usual|routine|ritual)\b/i],
  ['2.38', 'time-skip filler', /\b(passed in a blur|flew by|time slipped|before (he|she|you) knew it|lost track of time|blended together)\b/i],
];

const out = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  let blocks = [];
  try { blocks = extractBlocks(src).blocks.filter((k) => k.mediaType === 'text/x-ink'); }
  catch (e) { out.push({ file: relative(root, file), error: String(e.message || e) }); continue; }
  // line numbers in the file: the raw capture keeps the text as written, so each block is found by position
  const hits = [];
  let prose = 0;
  const seen = new Set();
  for (const blk of blocks) {
    if (seen.has(blk.raw)) continue;      // inkOf's rule: a repeated block counts once
    seen.add(blk.raw);
    const at = src.indexOf(blk.raw);
    const line0 = at < 0 ? -1 : src.slice(0, at).split('\n').length;
    blk.raw.split('\n').forEach((line, k) => {
      const ln = line0 < 0 ? -1 : line0 + k;
      const t = line.trim();
      // a person reads it: not blank, not an ink comment, not a pure tag, divert, VAR or knot line
      if (!t || t.startsWith('//') || /^(#|->|~|VAR |CONST |INCLUDE |===|==|=)/.test(t)) return;
      prose++;
      for (const [id, label, re] of RULES) if (re.test(t)) hits.push({ line: ln, id, label, text: t.length > 160 ? t.slice(0, 157) + '...' : t });
    });
  }
  out.push({ file: relative(root, file), prose, hits, per100: prose ? +(hits.length * 100 / prose).toFixed(1) : 0 });
}

if (process.env.JSON) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
for (const r of out) {
  if (r.error) { console.log(`\n${r.file}: could not capture (${r.error})`); continue; }
  console.log(`\n${r.file}: ${r.hits.length} hits in ${r.prose} prose lines (${r.per100} per 100)`);
  for (const h of r.hits) console.log(`  ${String(h.line).padStart(5)}  ${h.id.padEnd(5)} ${h.label}: ${h.text}`);
}
const tot = out.filter((r) => !r.error);
console.log(`\nTOTAL: ${tot.reduce((a, r) => a + r.hits.length, 0)} hits in ${tot.reduce((a, r) => a + r.prose, 0)} prose lines, ${tot.length} files`);
