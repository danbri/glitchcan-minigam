// A translation of a chapter must behave exactly like the English story: the same pages, panels, voice lines,
// memories, choices and variables at every step, whatever the reader does. This plays both with the real ink compiler
// and Story API, side by side, through the same random choices and taps (fixed seed), and compares them step by
// step: the tags (a memory tag without its sentence), how many choices are offered, and every variable. It also checks
// the translation's UI strings have every key of the English ones. No ink text is parsed.
//   node cozyverse/steeplewyke/tools/lang-check.mjs it [runs]     (STORY=ch2 by default; exit 1 on any difference)
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const inkjs = createRequire(import.meta.url)('inkjs/full');
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', process.env.STORY || 'ch2');
const lang = process.argv[2] || 'it', runs = +process.argv[3] || 600;
const base = readdirSync(dir).find((f) => /^[^.]+\.ink$/.test(f));
const compile = (f) => { const c = new inkjs.Compiler(readFileSync(join(dir, f), 'utf8')); const j = c.Compile().ToJson();
  if (c.errors?.length) throw new Error(`${f}: ${c.errors.join('; ')}`); return JSON.parse(j); };
const en = compile(base), tr = compile(base.replace(/\.ink$/, `.${lang}.ink`));
const pages = JSON.parse(readFileSync(join(dir, 'pages.json'), 'utf8')).pages;
const taps = Object.fromEntries(pages.map((p) => [p.n, [`p${p.n}`, ...p.panels.map((x) => x.ink)]]));
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const tagsOf = (s) => s.currentTags.map((t) => t.trim().replace(/^(memory\s*:\s*\w+\s+[+-]\d+).*$/, '$1'));
const vars = (s) => JSON.stringify([...s.variablesState._globalVariables.entries()].map(([k, v]) => [k, v.value]));
const fails = [];
let steps = 0;
for (let r = 0; r < runs && fails.length < 5; r++) {
  const a = new inkjs.Story(en), b = new inkjs.Story(tr);
  let page = 1;
  for (let n = 0; n < 300; n++) {
    let ta = [], tb = [];
    while (a.canContinue) { a.Continue(); ta.push(...tagsOf(a)); }
    while (b.canContinue) { b.Continue(); tb.push(...tagsOf(b)); }
    steps++;
    for (const t of ta) { const m = /^page:\s*(\d+)/.exec(t); if (m) page = +m[1]; }
    const where = `run ${r}, step ${n}`;
    if (ta.join('|') !== tb.join('|')) { fails.push(`${where}: tags differ\n  en: ${ta.join(' | ')}\n  ${lang}: ${tb.join(' | ')}`); break; }
    if (a.currentChoices.length !== b.currentChoices.length) { fails.push(`${where}: ${a.currentChoices.length} choices in English, ${b.currentChoices.length} in ${lang}: ${a.currentChoices.map((c) => c.text).join(' / ')}`); break; }
    if (vars(a) !== vars(b)) { fails.push(`${where}: variables differ`); break; }
    if (!a.currentChoices.length || a.currentChoices.length === 1 && /restart/.test(a.currentChoices[0].targetPath?.toString() || '')) break;
    if (rnd() < 0.25) { const t = taps[page][Math.floor(rnd() * taps[page].length)]; a.ChoosePathString(t); b.ChoosePathString(t); continue; }
    const k = Math.floor(rnd() * a.currentChoices.length); a.ChooseChoiceIndex(k); b.ChooseChoiceIndex(k);
  }
}
// the page's own words: every key of lang/en.json in lang/<code>.json
const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
const ui = (code) => JSON.parse(readFileSync(join(dir, 'lang', `${code}.json`), 'utf8'));
const missing = keys(ui('en')).filter((k) => !keys(ui(lang)).includes(k));
if (missing.length) fails.push(`lang/${lang}.json lacks: ${missing.join(', ')}`);
if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log(`${base.replace(/\.ink$/, `.${lang}.ink`)} behaves like ${base}: ${runs} readings, ${steps} steps, same tags, choices and variables; lang/${lang}.json complete`);
