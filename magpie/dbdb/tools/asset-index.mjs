#!/usr/bin/env node
/* asset-index.mjs — merge the store's records and check them.
 *
 * Joins the measured clip data, the hand-written subject from
 * subjects.json and the licence from sources.json into pack.json, and
 * fails when an element is undescribed, unlicensed, or carries a word that
 * states intended USE rather than what the thing is.
 *
 * The rule it enforces — the store describes what an element IS, never what
 * it is for — is in the splat-catalogue skill (§1, §2).
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

/* words that name a ROLE rather than a thing. "wall" is deliberately absent
   — a glasshouse wall panel is an object (splat-discovery skill). */
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
