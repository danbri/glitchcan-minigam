#!/usr/bin/env node
/* asset-index.mjs — THE ASSET STORE, AND ITS ONE RULE.
 *
 * The store says WHAT a thing is. It never says what it is for.
 *
 * That is not tidiness. An element named for its use is an element
 * nobody reaches for twice: a hedge cut as "maze wall" does not get
 * planted in a garden, and a shack filed under "swamp decor" never
 * becomes a mine head. The pack is a clone stamp for reality, and
 * reality does not come pre-assigned.
 *
 * So this tool merges three separable things into pack.json and then
 * checks the boundary held:
 *
 *   measured   what the clip actually is — counts, dims, the box it was
 *              cut with, which side the scanner saw. From the clipper.
 *   subject    what the object IS, in plain language. Hand-written in
 *              splats/subjects.json, because a machine guessing "this
 *              is a pickup truck" would be inventing.
 *   licence    who made it, under what terms, and where it came from.
 *              Structured, not a prose blob, so it can be checked.
 *
 * Intended use lives elsewhere and is welcome there: layouts and decor
 * flags in splatpack.html, and the wanting in splats/wanted.json.
 *
 * It FAILS if an element carries a use-word, has no subject, or has no
 * licence — the three ways this drifts.
 *
 * Usage:  node magpie/dbdb/tools/asset-index.mjs [--fix]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPLATS = path.resolve(HERE, '../splats');
const PJ = path.join(SPLATS, 'pack/pack.json');
const fix = process.argv.includes('--fix');

const pack = JSON.parse(fs.readFileSync(PJ, 'utf8'));
const { subjects } = JSON.parse(fs.readFileSync(path.join(SPLATS, 'subjects.json'), 'utf8'));

/* A credit line is prose; these are terms. Parsed from the credit the
   clipper inherits from the source scene, so there is one source of
   truth and this is only its structured view. */
const LIC = {
  'CC BY 4.0': { id: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/', attribution: true },
  'The Unlicense': { id: 'Unlicense', url: 'https://unlicense.org/', attribution: false },
};
function parseCredit(credit) {
  if (!credit) return null;
  const parts = credit.split('·').map(s => s.trim());
  const licName = Object.keys(LIC).find(k => credit.includes(k));
  const src = parts.find(p => /superspl\.at|huggingface|github/.test(p)) || null;
  return {
    work: parts[0] || null,
    author: parts[1] || null,
    source: src,
    ...(licName ? LIC[licName] : { id: 'UNKNOWN', url: null, attribution: true }),
  };
}

/* The words that mean "what it is FOR" rather than "what it IS".
   Note what is NOT here: "wall". A wall is an object — a glasshouse
   wall panel is a real thing with a real thickness, and the first
   version of this list rejected it, which was the list being wrong
   rather than the description. The test is whether the word names a
   role in a game or a composition; "tile", "decor" and "prop" do,
   "wall", "path" and "roof" do not. */
const USE_WORDS = /\b(tile|decor|prop|filler|maze|jungle|swamp|yard|level|stage|background|foreground|obstacle|collectible|spawn|checkpoint)\b/i;

let bad = 0;
const problems = [];
for (const el of pack.elements) {
  const s = subjects[el.id];
  if (!s) { problems.push(`${el.id}: no subject — add one to splats/subjects.json`); bad++; continue; }
  const lic = parseCredit(el.credit);
  if (!lic || lic.id === 'UNKNOWN') { problems.push(`${el.id}: licence not parsed from credit`); bad++; }
  /* the boundary check, on the words a person wrote */
  const prose = [s.what, s.note || ''].join(' ');
  const hit = prose.match(USE_WORDS);
  if (hit) { problems.push(`${el.id}: subject says "${hit[0]}" — that is a USE, not a description`); bad++; }
  if (fix) { el.subject = s; el.licence = lic; }
}

if (fix && !bad) {
  /* the store's own statement of what it is, carried with the data */
  pack.store = {
    describes: 'what each element IS',
    excludes: 'what any element is FOR — intended use lives in the game layouts and in splats/wanted.json',
    checkedBy: 'tools/asset-index.mjs',
  };
  pack.elements.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(PJ, JSON.stringify(pack, null, 1));
  console.log('wrote', path.relative(process.cwd(), PJ));
}

const byKind = {};
for (const el of pack.elements) {
  const k = subjects[el.id]?.kind || '?';
  (byKind[k] = byKind[k] || []).push(el.id);
}
console.log('\nthe store holds ' + pack.elements.length + ' elements\n');
for (const k of Object.keys(byKind).sort())
  console.log('  ' + k.padEnd(10) + byKind[k].join(', '));

const lics = {};
for (const el of pack.elements) {
  const l = parseCredit(el.credit);
  lics[l ? l.id : 'NONE'] = (lics[l ? l.id : 'NONE'] || 0) + 1;
}
console.log('\n  licences  ' + Object.entries(lics).map(([k, v]) => `${k} x${v}`).join(' · '));

if (problems.length) {
  console.log('\nPROBLEMS\n');
  for (const p of problems) console.log('  ' + p);
  console.log('\n' + problems.length + ' problem(s)');
  process.exit(1);
}
console.log('\nASSET STORE OK — every element described, licensed, and free of intended use');
