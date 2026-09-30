// How big an entry point becomes once every call is inlined, the way GPU compilers build a pipeline, and which
// functions make it big. Cold pipeline builds in this project take tens of seconds, and the cause each time was a
// large function with several call sites (the drift-city skill, "Compile time").
//   node drift-city/tools/wgsl-inline-report.mjs [entry] [files...]
//   default: entry "scene", files common.wgsl + gen/design.wgsl + scene.wgsl + rooms-off.wgsl (the city's pipeline)
// Prints the inlined size of the entry (in source lines), then the functions ranked by the lines they add in
// total (copies x own size), with their copy count. Estimates only: the compiler also removes dead code, and a
// call whose argument is a constant can shrink after inlining. It reads WGSL source, not ink.
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const [entry = 'scene', ...files0] = process.argv.slice(2);
const files = files0.length ? files0 : ['common.wgsl', 'gen/design.wgsl', 'scene.wgsl', 'rooms-off.wgsl'].map((f) => join(src, f));
// comments out, so a call named in a comment is not counted
const code = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n').replace(/\/\/[^\n]*/g, '');

// functions: name -> { body, lines }
const fns = new Map();
const re = /(?:@\w+(?:\([^)]*\))?\s*)*fn\s+(\w+)\s*\(/g;
let m;
while ((m = re.exec(code))) {
  const open = code.indexOf('{', m.index);
  let depth = 0, i = open;
  for (; i < code.length; i++) { if (code[i] === '{') depth++; else if (code[i] === '}' && --depth === 0) break; }
  const body = code.slice(open, i + 1);
  fns.set(m[1], { body, lines: body.split('\n').filter((l) => l.trim()).length });
}
const names = [...fns.keys()];
const callRe = new RegExp(`\\b(${names.join('|')})\\s*\\(`, 'g');
const calls = new Map();
for (const [n, f] of fns) {
  const c = new Map();
  for (const k of f.body.matchAll(callRe)) if (k[1] !== n) c.set(k[1], (c.get(k[1]) || 0) + 1);
  calls.set(n, c);
}
// inlined size and copy counts from the entry
const memo = new Map();
function size(n, stack = new Set()) {
  if (memo.has(n)) return memo.get(n);
  if (stack.has(n)) return 0;            // recursion is not allowed in WGSL; guard anyway
  stack.add(n);
  let s = fns.get(n).lines;
  for (const [c, k] of calls.get(n)) s += k * size(c, stack);
  stack.delete(n);
  memo.set(n, s);
  return s;
}
const copies = new Map();
function walk(n, mult) {
  copies.set(n, (copies.get(n) || 0) + mult);
  for (const [c, k] of calls.get(n)) walk(c, mult * k);
}
if (!fns.has(entry)) { console.error(`no function ${entry}`); process.exit(1); }
walk(entry, 1);
console.log(`${entry}: ${size(entry)} lines once inlined (${fns.get(entry).lines} of its own; ${copies.size} functions reached)`);
const rows = [...copies].filter(([n]) => n !== entry).map(([n, k]) => ({ n, k, own: fns.get(n).lines, total: k * fns.get(n).lines }))
  .sort((a, b) => b.total - a.total).slice(0, +(process.env.TOP || 25));
console.log('function'.padEnd(22), 'copies'.padStart(7), 'own'.padStart(6), 'total'.padStart(8));
for (const r of rows) console.log(r.n.padEnd(22), String(r.k).padStart(7), String(r.own).padStart(6), String(r.total).padStart(8));
