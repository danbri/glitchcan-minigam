#!/usr/bin/env node
// Offline story checker: compile every FINK file with the real inkjs
// compiler and then actually PLAY it, exhaustively, looking for the
// failures that only show up at runtime.
//
// Why this exists alongside inklet/validation/checkfink.mjs: that one
// drives a real browser (Puppeteer) and answers "does the player load
// this". This one needs no browser and no network, runs the whole
// corpus in a couple of seconds, and answers a different question —
// "does this story hold up when a player wanders around in it". The
// bugs it found on its first run had been in the tree for months:
//
//   tml-2025-langlearn  a final knot with no `-> END`: the Ukrainian
//                       tutorial died the moment you declined the intro
//   shane-manor (x2)    a knot whose choices were all one-time, reachable
//                       from a hub — go back once too often and the story
//                       ran out of content
//
// Neither is visible to a compiler, and neither shows up if you only
// walk the first choice of every knot. Hence breadth-first over the
// choice tree, with state save/restore.
//
// NO HACKPARSING: extraction is gcfink (which runs the sigil template),
// compilation is `new inkjs.Compiler(...).Compile()`. Nothing here reads
// ink as text.
//
// Usage:
//   node inklet/tools/fink-check.mjs                 # the whole corpus
//   node inklet/tools/fink-check.mjs path/to/x.fink.js
//   node inklet/tools/fink-check.mjs --paths 4000    # widen the search
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';
import { extractFinkFromJsSource } from '../../packages/finkcore/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const require = createRequire(join(repoRoot, 'package.json'));
const inkjs = require('inkjs/full');

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(argv[i + 1]);
};
const MAX_PATHS = flag('paths', 1500);   // distinct choice sequences explored
const MAX_DEPTH = flag('depth', 120);    // choices taken in one sequence
const files = argv.filter(a => !a.startsWith('--') && !/^\d+$/.test(a));

// The player injects an inventory knot and four variables into every
// story before compiling (fink-ink-engine.js getPrivateInventoryInk).
// A story that diverts to `_inventory` — world-between-worlds does —
// therefore compiles in the player and not on its own. Stand in for it
// with the smallest thing that satisfies the reference: this tool checks
// STORIES, and should not fail one for depending on shell furniture, nor
// drift when that furniture changes.
const SHELL_STUB = `
// === injected by fink-check, standing in for the player's own ===
VAR __check_diamonds = 0
=== _inventory ===
— INVENTORY —
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

/** Compile, or return the compiler's own error list. */
function compile(ink) {
  const c = new inkjs.Compiler(withShell(ink));
  try {
    const story = c.Compile();
    return { story, errors: c.errors || [], warnings: c.warnings || [] };
  } catch (e) {
    return { story: null, errors: (c.errors || []).length ? c.errors : [String(e)], warnings: c.warnings || [] };
  }
}

/**
 * Walk the choice tree breadth-first, restoring state to revisit a point
 * and take a different option. Every distinct (knot, choices-taken-so-far)
 * is explored once; identical states are not re-explored, which is what
 * keeps a hub-and-spoke story finite.
 */
function play(story) {
  const faults = [];       // { message, trail }
  const knots = new Set();
  let paths = 0, deepest = 0;
  const seen = new Set();

  story.onError = (msg, type) => faults.push({ message: `${type}: ${msg}`, trail: [...trail] });
  let trail = [];

  // Each job is "restore this saved state, take this choice, then run".
  // The root job restores nothing and takes nothing.
  const queue = [{ save: null, choice: null, trail: [] }];
  while (queue.length && paths < MAX_PATHS) {
    const job = queue.shift();
    paths++;
    trail = job.trail;
    try {
      if (job.save === null) {
        story.ResetState();
      } else {
        story.state.LoadJson(job.save);
        story.ChooseChoiceIndex(job.choice);
      }
      while (story.canContinue) {
        story.Continue();
        const p = story.state.currentPathString;
        if (p) knots.add(String(p).split('.')[0]);
      }
    } catch (e) {
      faults.push({ message: `THREW: ${String(e).split('\n')[0]}`, trail: [...trail] });
      continue;
    }
    deepest = Math.max(deepest, trail.length);
    if (!story.currentChoices.length || trail.length >= MAX_DEPTH) continue;
    const save = story.state.ToJson();
    for (let i = 0; i < story.currentChoices.length; i++) {
      const raw = story.currentChoices[i].text || '';
      // A line of prose that starts with `*` is a CHOICE to ink, not
      // emphasis — so `*** HAMPSTEAD ACHIEVED ***` became an option and
      // swallowed the paragraph after it. Sometimes that ends in "ran out
      // of content" and sometimes, as in Hampstead's victory screen, it
      // just silently eats the text. Nothing errors; the win screen is
      // simply blank. Choice labels here never legitimately contain an
      // asterisk, so this is a precise tell, read off the RUNTIME choice
      // rather than by parsing ink.
      if (raw.includes('*')) {
        faults.push({
          message: `LEAKED EMPHASIS: option "${raw.slice(0, 50)}" — a prose line starting with * became a choice (escape it: \\*)`,
          trail: [...trail],
        });
      }
      const label = (raw || `#${i}`).slice(0, 40);
      // A key on position alone would merge two genuinely different
      // situations (a hub visited with different flags set); a key that
      // included the whole trail would never merge anything and the
      // search would never terminate. Position + depth + which option is
      // the compromise that finds the hub-revisit bugs.
      const key = `${story.state.currentPathString}|${trail.length + 1}|${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ save, choice: i, trail: [...trail, label] });
    }
  }
  return { faults, knots, paths, deepest, truncated: queue.length > 0 };
}

async function corpus() {
  const out = [];
  for await (const f of glob('**/*.fink.js', { cwd: repoRoot })) {
    if (f.includes('node_modules') || f.startsWith('.git')) continue;
    out.push(join(repoRoot, f));
  }
  return out.sort();
}

// `resolve`, not `join`: join(cwd, '/abs/path') fabricates <cwd>/abs/path,
// which is how this tool ENOENT'd on 24 perfectly real files the first time
// it was pointed outside the repo (isle_of_glitch, July 2026).
const targets = files.length ? files.map(f => resolve(process.cwd(), f)) : await corpus();
let bad = 0;
console.log(`fink-check: ${targets.length} file(s), up to ${MAX_PATHS} paths each\n`);

for (const file of targets) {
  const name = relative(repoRoot, file);
  let ink;
  try {
    ink = extractFinkFromJsSource(readFileSync(file, 'utf8'));
  } catch (e) {
    console.log(`✖ ${name}\n    EXTRACT: ${String(e).split('\n')[0]}`);
    bad++; continue;
  }
  if (typeof ink !== 'string' || !ink.trim()) {
    // An empty extraction usually means a stray backtick closed the
    // template early — the format's own footgun, and invisible until
    // something tries to compile the result.
    console.log(`✖ ${name}\n    EXTRACT: no ink (stray backtick in the template?)`);
    bad++; continue;
  }
  const { story, errors } = compile(ink);
  if (!story || errors.length) {
    console.log(`✖ ${name}\n    ${errors.slice(0, 4).join('\n    ')}`);
    bad++; continue;
  }
  const r = play(story);
  if (r.faults.length) {
    bad++;
    const first = r.faults[0];
    console.log(`✖ ${name}  (${r.paths} paths, ${r.knots.size} knots)`);
    console.log(`    ${first.message}`);
    if (first.trail.length) console.log(`    after: ${first.trail.slice(-6).join(' → ')}`);
    if (r.faults.length > 1) console.log(`    (+${r.faults.length - 1} more)`);
  } else {
    console.log(`✔ ${name}  ${r.paths} paths, ${r.knots.size} knots, depth ${r.deepest}`
      + (r.truncated ? ' (search truncated)' : ''));
  }
}

console.log(bad ? `\nFINK CHECK: ${bad} file(s) with faults` : '\nFINK CHECK: all clean');
process.exitCode = bad ? 1 : 0;
