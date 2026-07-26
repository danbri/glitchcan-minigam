#!/usr/bin/env node
// fink-minigame-map.mjs — which stories reference which minigames?
//
//   node inklet/tools/fink-minigame-map.mjs            # markdown table
//
// NO HACKPARSING: extraction is finkcore (runs the sigil template for real),
// compilation is real inkjs, and tags are read from the COMPILED story via
// the Story API — TagsForContentAtPath per named knot plus the global tags —
// never by regexing ink text. A MINIGAME tag that does not survive
// compilation is not a reference, it is a typo, and this tool should agree
// with the player about which is which.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';
import { extractFinkFromJsSource } from '../../packages/finkcore/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const require = createRequire(join(repoRoot, 'package.json'));
const inkjs = require('inkjs/full');

// Same shell stand-ins fink-check uses: the player injects these before
// compiling, so a story depending on them is valid IN THE PLAYER.
const SHELL_STUB = `
VAR __map_stub = 0
=== _inventory ===
inventory
-> DONE
`;
const NEEDS = (src, name) => !new RegExp(`VAR\\s+${name}\\s*=`).test(src);
function withShell(ink) {
  let pre = '';
  for (const v of ['diamonds', 'mega_diamonds', 'keys', 'score']) {
    if (NEEDS(ink, v)) pre += `VAR ${v} = 0\n`;
  }
  return pre + ink + SHELL_STUB;
}

const tagOf = (tags, name) =>
  (tags || []).filter(t => t.trim().toUpperCase().startsWith(`${name}:`))
              .map(t => t.trim().slice(name.length + 1).trim());

const rows = [];
const patterns = ['inklet/**/*.fink.js', 'cozyverse/*.fink.js'];
const allFiles = [];
for (const pat of patterns) for await (const f of glob(pat, { cwd: repoRoot })) allFiles.push(f);
for (const file of allFiles) {
  const src = readFileSync(join(repoRoot, file), 'utf8');
  let ink;
  try { ink = extractFinkFromJsSource(src); } catch (e) { rows.push({ file, error: `extract: ${e.message}` }); continue; }
  if (!ink || !ink.trim()) { rows.push({ file, error: 'no ink extracted' }); continue; }
  let story;
  try {
    story = new inkjs.Compiler(withShell(ink)).Compile();
  } catch (e) { rows.push({ file, error: `compile: ${String(e.message || e).slice(0, 60)}` }); continue; }

  const minigames = new Map();      // game -> Set(knot)
  const links = new Set();          // # FINK: outbound story links
  const note = (map, g, where) => {
    if (!map.has(g)) map.set(g, new Set());
    map.get(g).add(where);
  };
  for (const g of tagOf(story.globalTags, 'MINIGAME')) note(minigames, g, '(global)');
  for (const g of tagOf(story.globalTags, 'FINK')) links.add(g);
  const knots = [...story.mainContentContainer.namedOnlyContent.keys()]
    .filter(k => !k.startsWith('_') && k !== 'global decl');

  // Knot-HEADER tags alone under-report: a `# MINIGAME:` on a line inside a
  // knot (Hampstead's robbin is one) only surfaces at runtime, in
  // currentTags. So: a bounded breadth-first PLAYTHROUGH, harvesting
  // currentTags after every Continue — the same thing the player sees.
  const harvest = () => {
    const knot = (story.state.currentPathString || '').split('.')[0] || '(flow)';
    for (const g of tagOf(story.currentTags, 'MINIGAME')) note(minigames, g, knot);
    for (const g of tagOf(story.currentTags, 'FINK')) links.add(g);
  };
  const queue = [[]];
  const seenSeq = new Set(['']);
  let budget = 800;
  while (queue.length && budget-- > 0) {
    const seq = queue.shift();
    try {
      story.ResetState();
      let ok = true;
      const replay = (i) => {
        while (story.canContinue) { story.Continue(); harvest(); }
        if (i < seq.length) {
          if (seq[i] >= story.currentChoices.length) { ok = false; return; }
          story.ChooseChoiceIndex(seq[i]); replay(i + 1);
        }
      };
      replay(0);
      if (!ok || seq.length >= 25) continue;
      for (let c = 0; c < story.currentChoices.length; c++) {
        const next = [...seq, c];
        const key = next.join(',');
        if (!seenSeq.has(key)) { seenSeq.add(key); queue.push(next); }
      }
    } catch { /* a crashing branch is fink-check's business, not this map's */ }
  }
  rows.push({ file, knots: knots.length,
    minigames: new Map([...minigames].map(([g, ks]) => [g, [...ks]])),
    links: [...links] });
}

// ── the table ──────────────────────────────────────────────────────────
const seen = new Map();             // game -> stories count
console.log('| story | knots | minigames (knot) | # FINK: links out |');
console.log('|---|---|---|---|');
for (const r of rows.sort((a, b) => a.file.localeCompare(b.file))) {
  const name = r.file.replace(/^inklet\//, '');
  if (r.error) { console.log(`| \`${name}\` | — | ⚠ ${r.error} | |`); continue; }
  const games = [...r.minigames.entries()]
    .map(([g, ks]) => { seen.set(g, (seen.get(g) || 0) + 1); return `**${g}** (${ks.join(', ')})`; })
    .join(' · ') || '—';
  console.log(`| \`${name}\` | ${r.knots} | ${games} | ${r.links.length ? r.links.map(l => `\`${l}\``).join(' ') : '—'} |`);
}
console.log(`\nMinigames referenced from stories: ${[...seen.keys()].sort().join(', ') || 'none'}`);
