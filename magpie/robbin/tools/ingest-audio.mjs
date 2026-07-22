#!/usr/bin/env node
/*
  Ingest the tape library: hash every track, catch duplicates, map
  per-station filenames to real stations, regenerate robbin-tracks.js
  and audio/HASHES.sha256.

  Usage (from anywhere):  node magpie/robbin/tools/ingest-audio.mjs
    --check   report only, write nothing (exit 1 on dupes/unmapped)

  Duplicates are reported and left out of the manifest — files are
  NEVER deleted here. Unmapped per-station names are listed for a
  human: either rename the file, or add an alias below.
*/
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = join(ROOT, 'audio');
const CHECK = process.argv.includes('--check');

// area / shorthand → the exact station that plays the track.
// Left side is the NORMALIZED filename (uppercase, alphanumerics only).
const ALIASES = {
  KINGSCROSS: "KING'S CROSS ST PANCRAS",
  KINGSX: "KING'S CROSS ST PANCRAS",
  STPANCRAS: "KING'S CROSS ST PANCRAS",
  SOHO: 'OXFORD CIRCUS',
  WESTEND: 'LEICESTER SQUARE',
  THECITY: 'BANK',
  CITY: 'BANK',
  CANARYWHARF: 'CANARY WHARF',
  DOCKLANDS: 'CANARY WHARF',
  WESTMINSTER: 'WESTMINSTER',
  CAMDEN: 'CAMDEN TOWN',
  NOTTINGHILL: 'NOTTING HILL GATE',
  SHOREDITCH: 'SHOREDITCH HIGH STREET',
  BRICKLANE: 'SHOREDITCH HIGH STREET',
  HEATHROW: 'HEATHROW TERMINALS 2 & 3',
  OLYMPICPARK: 'STRATFORD',
  GREENWICH: 'CUTTY SARK',
  WHITECHAPEL: 'WHITECHAPEL',
  ANGELISLINGTON: 'ANGEL',
  ISLINGTON: 'ANGEL',
  ELEPHANT: 'ELEPHANT & CASTLE',
  THEELEPHANT: 'ELEPHANT & CASTLE',
};

const { NETWORK } = await import(join(ROOT, 'tube-network.js'));
const STATIONS = Object.keys(NETWORK.pos);
const norm = s => s.toUpperCase().replace(/&/g, 'AND').replace(/[^A-Z0-9]/g, '');
const byNorm = new Map(STATIONS.map(s => [norm(s), s]));

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

function mapStation(stem) {
  const n = norm(stem);
  if (byNorm.has(n)) return { station: byNorm.get(n), how: 'exact' };
  if (ALIASES[n]) return { station: ALIASES[n], how: 'alias' };
  const starts = STATIONS.filter(s => norm(s).startsWith(n) || n.startsWith(norm(s)));
  if (starts.length === 1) return { station: starts[0], how: 'prefix' };
  const close = STATIONS.map(s => [lev(norm(s), n), s]).sort((a, b) => a[0] - b[0]);
  if (close[0][0] <= 2 && (close.length < 2 || close[1][0] > close[0][0])) {
    return { station: close[0][1], how: `fuzzy(${close[0][0]})` };
  }
  return { station: null, near: close.slice(0, 4).map(c => c[1]) };
}

const listAudio = dir => existsSync(dir)
  ? readdirSync(dir).filter(f => /\.(mp3|m4a|ogg)$/i.test(f)).sort()
  : [];

const files = [
  ...['the-quiet-engines.mp3', 'gears-and-birdcalls.mp3', 'the-inexorable-passacaglia.mp3']
    .filter(f => existsSync(join(AUDIO, f))).map(f => ({ rel: f, kind: 'core' })),
  ...listAudio(join(AUDIO, 'per-station')).map(f => ({ rel: `per-station/${f}`, kind: 'station' })),
  ...listAudio(join(AUDIO, 'generic')).map(f => ({ rel: `generic/${f}`, kind: 'generic' })),
];

const seen = new Map();   // hash -> first rel
const dupes = [];
for (const f of files) {
  f.hash = createHash('sha256').update(readFileSync(join(AUDIO, f.rel))).digest('hex');
  f.bytes = readFileSync(join(AUDIO, f.rel)).length;
  if (seen.has(f.hash)) { f.dupeOf = seen.get(f.hash); dupes.push(f); }
  else seen.set(f.hash, f.rel);
}

const perStation = {};
const unmapped = [];
for (const f of files) {
  if (f.kind !== 'station' || f.dupeOf) continue;
  const stem = basename(f.rel, extname(f.rel));
  const m = mapStation(stem);
  if (!m.station) { unmapped.push({ rel: f.rel, near: m.near }); continue; }
  if (perStation[m.station]) {
    console.log(`! ${f.rel}: ${m.station} already has ${perStation[m.station]} — skipped`);
    continue;
  }
  perStation[m.station] = f.rel;
  console.log(`  ${f.rel}  →  ${m.station}  (${m.how})`);
}
const generic = files.filter(f => f.kind === 'generic' && !f.dupeOf).map(f => f.rel);

for (const d of dupes) console.log(`! DUPLICATE ${d.rel} — same audio as ${d.hash === undefined ? '?' : d.dupeOf} (skipped, not deleted)`);
for (const u of unmapped) console.log(`! UNMAPPED ${u.rel} — nearest stations: ${u.near.join(' · ')}\n  rename it, or add an alias at the top of this tool`);
console.log(`${files.length} file(s): ${Object.keys(perStation).length} per-station, ${generic.length} generic, ${dupes.length} duplicate(s), ${unmapped.length} unmapped`);

if (!CHECK) {
  const manifest = `// GENERATED by tools/ingest-audio.mjs — hand-edits will be overwritten.
// Run the tool after adding files under audio/per-station/ or
// audio/generic/. Paths are relative to audio/.
//
// perStation: a station's own song, played when the flock is inside it
// (two visits in three — a generic track takes the third turn, against
// monotony). generic: the rotation for every other station, alongside
// GEARS AND BIRDCALLS.
export const TRACKS = ${JSON.stringify({ perStation, generic }, null, 2).replace(/"([a-zA-Z]+)":/g, '$1:')};
`;
  writeFileSync(join(ROOT, 'robbin-tracks.js'), manifest);
  writeFileSync(join(AUDIO, 'HASHES.sha256'),
    files.map(f => `${f.hash}  ${f.rel}`).join('\n') + '\n');
  console.log('wrote robbin-tracks.js + audio/HASHES.sha256');
}
process.exit(CHECK && (dupes.length || unmapped.length) ? 1 : 0);
