#!/usr/bin/env node
/**
 * fink-vars.mjs — the variable governance report.
 *
 * Answers, for the whole corpus:
 *   · which variables each story declares
 *   · which variables each minigame may write (manifest capability)
 *   · when two independent works both say `score` or `points`, are they
 *     WIRED TOGETHER on purpose or COLLIDING by accident
 *   · which guest writes hit no declared variable at all (dead writes)
 *   · which guests ship no manifest (and so, since the June 2026
 *     enforcement, can write nothing)
 *
 * The model it checks against is FoafVars (packages/foafos/src/vars.mjs):
 *   SHARED   diamonds, mega_diamonds, keys, score — one economy, shared
 *            across works on purpose.
 *   PRIVATE  everything else. Two works using the same private name are
 *            a collision to report: they run as separate Story objects,
 *            so nothing is actually shared — but a guest allowed to
 *            write that name can hit whichever story happens to be
 *            hosting it. That is the "story2 messing with story1's
 *            innards" case.
 *
 * No hackparsing: story content is captured by EXECUTING the .fink.js
 * in a vm (the oooOO sigil), compiled with the real inkjs, and the
 * declared variables are read from the compiled Story's VariablesState.
 * Nothing here regexes Ink structure.
 *
 *   node inklet/tools/fink-vars.mjs             # human report
 *   node inklet/tools/fink-vars.mjs --json      # machine report
 *   node inklet/tools/fink-vars.mjs --strict    # exit 1 on any defect
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SHARED_DEFAULT, HOST_CONTEXT } from '../../packages/foafos/src/vars.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
const { Compiler } = require(path.join(ROOT, 'third_party/ink/ink-full.js'));

const SHARED = new Set(SHARED_DEFAULT);
const CONTEXT = new Set(HOST_CONTEXT);
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// The player injects this knot into every story (spec §2); a standalone
// compile needs it stubbed.
const INVENTORY_STUB = '\n=== _inventory ===\nstub.\n-> END\n';

function extractInk(jsSource, filename) {
  const blocks = [];
  const capture = (strings) => { blocks.push(strings.raw.join('')); return ''; };
  const sandbox = {
    oooOO: capture,
    OO: () => capture,
    console: { log() {}, warn() {}, error() {} },
    window: {}, document: undefined,
  };
  try {
    vm.createContext(sandbox);
    vm.runInContext(jsSource, sandbox, { timeout: 5000, filename });
  } catch { /* a file that throws still yields whatever it captured */ }
  return [...new Set(blocks)].join('\n');
}

async function walk(dir, out = []) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'vendor') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith('.fink.js')) out.push(p);
  }
  return out;
}

// Declared variables, read from the compiled story — not from the text.
function declaredVars(story) {
  const gv = story.variablesState?._globalVariables;
  if (!gv || typeof gv.keys !== 'function') return null;
  const out = {};
  for (const name of gv.keys()) {
    let value;
    try { value = story.variablesState[name]; } catch { value = undefined; }
    out[name] = { type: typeof value, value };
  }
  return out;
}

// A variable the platform auto-injects into every story is not evidence
// of an author's intent; exclude it from collision counting.
const INJECTED = new Set(SHARED_DEFAULT);

// `shane-manor.fink.js` and `_tmp_shane-manor.fink.js` are one work in
// two files, not two authors who happened to pick the same 24 names.
// Collapse those before counting collisions, or the real signal drowns.
function canonicalWork(id) {
  const dir = path.posix.dirname(id);
  const base = path.posix.basename(id)
    .replace(/^_?tmp[-_]/i, '')
    .replace(/[-_](old|bak|backup|copy|wip|v\d+)(?=\.fink\.js$)/i, '');
  return `${dir}/${base}`;
}

async function build() {
  const works = [];   // { id, kind:'story', vars:{name:{type,value}}, error? }
  const guests = [];  // { id, kind:'guest', read:[], write:[], manifest:bool }

  // --- stories -------------------------------------------------------
  const files = await walk(path.join(ROOT, 'inklet'));
  await walk(path.join(ROOT, 'cozyverse'), files);
  for (const file of files) {
    const id = rel(file);
    const src = await fs.readFile(file, 'utf8');
    let ink = extractInk(src, id);
    if (!ink.trim()) { works.push({ id, kind: 'story', vars: {}, error: 'no ink captured' }); continue; }
    if (/->\s*_inventory/.test(ink) && !/^\s*===\s*_inventory\s*===/m.test(ink)) ink += INVENTORY_STUB;
    try {
      const story = new Compiler(ink).Compile();
      const vars = declaredVars(story);
      works.push({ id, kind: 'story', vars: vars || {},
        error: vars ? undefined : 'variables unreadable from this inkjs build' });
    } catch (e) {
      works.push({ id, kind: 'story', vars: {}, error: String(e.message || e).slice(0, 120) });
    }
  }

  // --- guests --------------------------------------------------------
  const gameDir = path.join(ROOT, 'inklet/minigames');
  for (const e of await fs.readdir(gameDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const mf = path.join(gameDir, e.name, 'manifest.json');
    let manifest = null;
    try { manifest = JSON.parse(await fs.readFile(mf, 'utf8')); } catch { /* none */ }
    guests.push({
      id: e.name, kind: 'guest',
      manifest: !!manifest,
      read: manifest?.variables?.read || [],
      write: manifest?.variables?.write || [],
    });
  }

  // --- the report ----------------------------------------------------
  // name → { declaredBy:[storyId], writableBy:[guestId], readableBy:[] }
  const names = new Map();
  const touch = (n) => {
    if (!names.has(n)) names.set(n, { name: n, declaredBy: [], writableBy: [], readableBy: [] });
    return names.get(n);
  };
  for (const w of works) for (const n of Object.keys(w.vars)) touch(n).declaredBy.push(w.id);
  for (const g of guests) {
    for (const n of g.write) touch(n).writableBy.push(g.id);
    for (const n of g.read) touch(n).readableBy.push(g.id);
  }

  const classify = (e) => {
    if (SHARED.has(e.name)) return 'shared';
    if (CONTEXT.has(e.name)) return 'context';
    // declared by more than one DISTINCT work and not part of the
    // platform's injected economy: two authors independently picked
    // one name
    if (e.works.length > 1 && !INJECTED.has(e.name)) return 'collision';
    return 'private';
  };
  for (const e of names.values()) {
    e.works = [...new Set(e.declaredBy.map(canonicalWork))];
    e.class = classify(e);
  }

  const defects = [];
  for (const g of guests) {
    if (!g.manifest) {
      defects.push({ level: 'error', kind: 'unmanifested', who: g.id,
        detail: `no manifest.json — the shell grants it no variable writes at all` });
    }
    for (const n of g.write) {
      const e = names.get(n);
      if (!e.declaredBy.length) {
        defects.push({ level: 'warn', kind: 'dead-write', who: g.id,
          detail: `may write "${n}", which no story declares — the assignment will throw and be swallowed` });
      }
      if (e.class === 'collision') {
        defects.push({ level: 'error', kind: 'cross-work-write', who: g.id,
          detail: `may write "${n}", a private name declared by ${e.works.length} independent works (${e.works.join(", ")})` });
      }
    }
  }
  for (const e of names.values()) {
    if (e.class !== 'collision') continue;
    defects.push({ level: 'warn', kind: 'name-collision', who: e.name,
      detail: `declared privately by ${e.works.length} works: ${e.works.join(", ")} — separate Story objects, so NOT wired together; rename or promote to the shared economy` });
  }

  return {
    generated: 'fink-vars.mjs',
    shared: [...SHARED], context: [...CONTEXT],
    counts: {
      stories: works.length, guests: guests.length, names: names.size,
      collisions: [...names.values()].filter(e => e.class === 'collision').length,
      defects: defects.length,
    },
    works, guests, names: [...names.values()], defects,
  };
}

const report = await build();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 1));
} else {
  const c = report.counts;
  console.log(`FINK variable governance — ${c.stories} stories, ${c.guests} guests, ${c.names} names\n`);

  console.log('SHARED ECONOMY (wired together on purpose)');
  for (const e of report.names.filter(n => n.class === 'shared')) {
    console.log(`  ${e.name.padEnd(16)} declared by ${e.declaredBy.length} works · writable by ${e.writableBy.length ? e.writableBy.join(', ') : '—'}`);
  }

  const guestOwned = report.names.filter(n => n.writableBy.length && n.class !== 'shared');
  console.log('\nGUEST-WRITABLE PRIVATE NAMES');
  for (const e of guestOwned) {
    console.log(`  ${e.name.padEnd(24)} ← ${e.writableBy.join(', ')}${e.declaredBy.length ? '' : '   (no story declares it)'}`);
  }

  console.log('\nGUEST CAPABILITY');
  for (const g of report.guests) {
    console.log(`  ${g.id.padEnd(14)} ${g.manifest ? `write: ${g.write.join(', ') || '(none)'}` : 'NO MANIFEST → writes denied'}`);
  }

  const collisions = report.names.filter(n => n.class === 'collision');
  console.log(`\nCOLLISIONS (same private name, independent works): ${collisions.length}`);
  for (const e of collisions) console.log(`  ${e.name}: ${e.declaredBy.join(', ')}`);

  const errs = report.defects.filter(d => d.level === 'error');
  const warns = report.defects.filter(d => d.level === 'warn');
  console.log(`\nDEFECTS: ${errs.length} error, ${warns.length} warn`);
  for (const d of [...errs, ...warns]) console.log(`  [${d.level}] ${d.kind} · ${d.who}: ${d.detail}`);

  const broken = report.works.filter(w => w.error);
  if (broken.length) console.log(`\n${broken.length} works did not compile (variables unknown): ` +
    broken.slice(0, 6).map(w => w.id).join(', ') + (broken.length > 6 ? ' …' : ''));
}

if (process.argv.includes('--strict') && report.defects.some(d => d.level === 'error')) {
  process.exitCode = 1;
}
