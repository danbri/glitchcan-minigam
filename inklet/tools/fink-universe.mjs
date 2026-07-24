#!/usr/bin/env node
/**
 * fink-universe.mjs — the whole finkiverse as one graph: stories AND
 * the widgets they embed.
 *
 * The older `fink-graph.mjs` maps story→story FINK links. This adds the
 * other half of the platform: `# MINIGAME:` widget invocations, and the
 * `# LINKREL:` depth semantics (goDeeper/goShallower/oneWay) that the
 * dream stack implements — so one picture answers "what links to what,
 * how, and how deep".
 *
 * No hackparsing: content is captured by executing the .fink.js in a vm
 * (the oooOO sigil), compiled with the real inkjs, and tags are read
 * from the COMPILED story per knot — never regexed out of the source.
 *
 *   node inklet/tools/fink-universe.mjs            # write docs/fink-universe.json
 *   node inklet/tools/fink-universe.mjs --print    # summary to stdout
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
const inkjs = require(path.join(ROOT, 'third_party/ink/ink-full.js'));
const { Compiler } = inkjs;

// The player injects this knot into every story; standalone compiles
// need it stubbed (spec §2).
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
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'vendor') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith('.fink.js')) out.push(p);
  }
  return out;
}

// Tags of a knot, read from the compiled story (never from the source).
// Walks the whole knot: moment tags such as `# MINIGAME:` are INLINE on
// a text line (spec §3.2), which may be several lines in — stopping at
// the first Continue would miss them (it missed hampstead→robbin).
function knotTags(story, name, maxLines = 40) {
  const tags = [];
  const add = (list) => { for (const t of list || []) if (!tags.includes(t)) tags.push(t); };
  try {
    story.ResetState();
    story.ChoosePathString(name);
    add(story.currentTags);
    let n = 0;
    while (story.canContinue && n++ < maxLines) {
      story.Continue();
      add(story.currentTags);
    }
  } catch { /* some knots are not directly navigable */ }
  return tags;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

async function build() {
  const files = await walk(path.join(ROOT, 'inklet'))
    .then(a => walk(path.join(ROOT, 'cozyverse'), a).catch(() => a));
  const nodes = new Map();   // id → node
  const edges = [];
  const node = (id, patch) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind: 'story', title: id.split('/').pop(), links: 0 });
    Object.assign(nodes.get(id), patch);
    return nodes.get(id);
  };

  for (const file of files) {
    const id = rel(file);
    const src = await fs.readFile(file, 'utf8');
    let ink = extractInk(src, id);
    if (!ink.trim()) { node(id, { kind: 'story', error: 'no ink captured' }); continue; }
    if (/->\s*_inventory/.test(ink) && !/^\s*===\s*_inventory\s*===/m.test(ink)) ink += INVENTORY_STUB;

    let story;
    try {
      const compiler = new Compiler(ink);
      story = compiler.Compile();
    } catch (e) {
      node(id, { error: String(e.message || e).slice(0, 120) });
      continue;
    }

    const knots = [...(story.mainContentContainer?.namedContent?.keys?.() || [])]
      .filter(k => typeof k === 'string');
    const self = node(id, { knots: knots.length, bytes: src.length });

    // global tags + per-knot tags, all from the compiled story
    const seen = [];
    for (const t of story.globalTags || []) seen.push({ knot: null, tag: t });
    for (const k of knots) for (const t of knotTags(story, k)) seen.push({ knot: k, tag: t });

    for (const { knot, tag } of seen) {
      const m = /^\s*(FINK|MINIGAME|LINKREL)\s*:\s*(.+)$/i.exec(tag);
      if (!m) continue;
      const kind = m[1].toUpperCase();
      const value = m[2].trim();

      if (kind === 'FINK') {
        // strip the //-truncation escape (spec §3.1)
        const target = value.replace(/\\\//g, '/');
        // deploy-root-absolute paths (/glitchcan-minigam/…) resolve
        // against the repo root, not the file — otherwise every TOC
        // link came out as ../../../
        const targetId = /^https?:/i.test(target) ? target
          : target.startsWith('/')
            ? rel(path.join(ROOT, target.replace(/^\/[^/]+\//, '')))
            : rel(path.resolve(path.dirname(file), target));
        node(targetId, /^https?:/i.test(target) ? { kind: 'external', title: targetId } : {});
        edges.push({ from: id, to: targetId, type: 'fink', knot });
        self.links++;
      } else if (kind === 'MINIGAME') {
        const name = value.split(/\s+/)[0].toLowerCase();
        const wid = `widget:${name}`;
        node(wid, { kind: 'widget', title: name });
        edges.push({ from: id, to: wid, type: 'minigame', knot, spec: value });
        self.links++;
      } else if (kind === 'LINKREL') {
        // attach to the most recent fink edge from this file/knot
        for (let i = edges.length - 1; i >= 0; i--) {
          if (edges[i].from === id && edges[i].type === 'fink') { edges[i].linkrel = value.toLowerCase(); break; }
        }
      }
    }
  }

  // Widgets: is this name actually registered, and how is it delivered?
  // The registry is read by EXECUTING fink-minigames.js against a stub
  // window (it assigns window.FinkMinigames) — no parsing of source.
  let registry = { info: {}, iframe: [] };
  try {
    const src = await fs.readFile(path.join(ROOT, 'inklet/finkapp/fink-minigames.js'), 'utf8');
    const box = { window: {}, document: { getElementById: () => null, addEventListener() {} } };
    box.window.document = box.document;
    vm.createContext(box);
    vm.runInContext(src, box, { timeout: 5000 });
    const fm = box.window.FinkMinigames || {};
    registry = { info: fm.minigameInfo || {}, iframe: fm.iframeMinigames || [] };
  } catch { /* registry unreadable — leave widgets unannotated */ }

  for (const n of nodes.values()) {
    if (n.kind !== 'widget') continue;
    const name = n.title;
    n.registered = Object.prototype.hasOwnProperty.call(registry.info, name);
    n.delivery = registry.iframe.includes(name) ? 'iframe' : n.registered ? 'inline' : 'unknown';
    n.packaged = await fs.access(path.join(ROOT, 'inklet/minigames', name, 'index.html'))
      .then(() => true).catch(() => false);
    // a name no story can actually launch is the real defect
    if (!n.registered) n.error = 'not in the minigame registry';
    else if (n.delivery === 'iframe' && !n.packaged) n.error = 'registered as iframe but no package on disk';
  }

  // orphans: story files nothing links to
  const linked = new Set(edges.map(e => e.to));
  for (const n of nodes.values()) if (n.kind === 'story' && !linked.has(n.id)) n.entry = true;

  return {
    generated: 'fink-universe.mjs',
    counts: {
      stories: [...nodes.values()].filter(n => n.kind === 'story').length,
      widgets: [...nodes.values()].filter(n => n.kind === 'widget').length,
      external: [...nodes.values()].filter(n => n.kind === 'external').length,
      edges: edges.length,
    },
    nodes: [...nodes.values()],
    edges,
  };
}

const universe = await build();
if (process.argv.includes('--print')) {
  console.log(JSON.stringify(universe.counts, null, 1));
  for (const e of universe.edges) {
    console.log(`${e.from}  --${e.type}${e.linkrel ? '/' + e.linkrel : ''}-->  ${e.to}${e.knot ? `   (${e.knot})` : ''}`);
  }
  const broken = universe.nodes.filter(n => n.error);
  if (broken.length) console.log('\nnot compiled:', broken.map(n => `${n.id}: ${n.error}`).join('\n  '));
} else {
  const out = path.join(ROOT, 'docs/fink-universe.json');
  await fs.writeFile(out, JSON.stringify(universe, null, 1));
  console.log(`${rel(out)}: ${universe.counts.stories} stories, ${universe.counts.widgets} widgets, ${universe.counts.edges} edges`);
}
