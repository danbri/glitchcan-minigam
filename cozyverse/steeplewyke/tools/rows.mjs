// The bell rows of chapter 2 (Plain Hunt), made from the plain hunt rule and checked against the story text with
// the real ink compiler and Story API: Win's napkin (plain hunt on five), the three rows Glenys heard with one bell
// silent and the other four numbered again by note, and what Dr Achebe says each wrong guess would have sounded like.
// It also proves the puzzle has one answer: only one silent bell, at any place in the hunt, fits Glenys's rows.
//   node cozyverse/steeplewyke/tools/rows.mjs          (exit 1 when the story and the rule disagree)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const inkjs = createRequire(import.meta.url)('inkjs/full');
const here = dirname(fileURLToPath(import.meta.url));

// plain hunt on n bells: swap pairs from the first place, then from the second, until rounds come back
const hunt = (n) => {
  let r = [...Array(n)].map((_, i) => i + 1); const rows = [r.join(' ')];
  for (let k = 0; ; k++) {
    r = [...r]; for (let i = k % 2; i + 1 < n; i += 2) [r[i], r[i + 1]] = [r[i + 1], r[i]];
    rows.push(r.join(' ')); if (rows.at(-1) === rows[0]) return rows;
  }
};
// one bell silent: the listener hears the other four and numbers them by note, highest (the treble) first
const heard = (row, silent) => { const rest = row.split(' ').map(Number).filter((b) => b !== silent); const s = [...rest].sort();
  return rest.map((b) => s.indexOf(b) + 1).join(' '); };

const five = hunt(5);
const START = 3;                                    // the rows from 8.14: 4 2 5 1 3, 4 5 2 3 1, 5 4 3 2 1
const real = five.slice(START, START + 3);
const glenys = real.map((r) => heard(r, 4));
// unique: no other silent bell, at any place in the ten rows, sounds like this
const fits = [];
for (let b = 1; b <= 5; b++) for (let s = 0; s < 10; s++) if (glenys.every((g, i) => heard(five[(s + i) % 10], b) === g)) fits.push([b, s]);

const story = JSON.parse(new inkjs.Compiler(readFileSync(join(here, '..', 'ch2', 'plainhunt.ink'), 'utf8')).Compile().ToJson());
const read = (path, set = {}) => { const s = new inkjs.Story(story); for (const [k, v] of Object.entries(set)) s.variablesState[k] = v;
  s.ChoosePathString(path); let t = ''; while (s.canContinue) t += s.Continue(); return t.split('\n').map((l) => l.trim()).filter(Boolean); };

const fails = [];
// p1_napkin first goes through its guard to p1_win, so read it after a visit
const s = new inkjs.Story(story); s.ChoosePathString('p1_win'); while (s.canContinue) s.Continue();
s.ChoosePathString('p1_napkin'); let nt = ''; while (s.canContinue) nt += s.Continue();
const napkinRows = nt.split('\n').map((l) => l.trim()).filter((l) => /^[1-5]( [1-5]){4}$/.test(l));
if (napkinRows.join('|') !== five.join('|')) fails.push(`napkin: ${napkinRows.join(' / ')} is not plain hunt on five`);
const email = read('p9_email', { rows: true }).filter((l) => /^[1-4]( [1-4]){3}$/.test(l));
if (email.join('|') !== glenys.join('|')) fails.push(`Glenys's rows: ${email.join(' / ')}, the rule gives ${glenys.join(' / ')}`);
const words = { 1: 'one', 2: 'two', 3: 'three', 5: 'five' };
for (const b of [1, 2, 3, 5]) {
  const line = read(`p9_${words[b]}`).find((l) => l.startsWith('Achebe:')) || '';
  if (!line.includes(`would sound ${heard(real[0], b)}.`)) fails.push(`p9_${words[b]}: "${line}" (the rule gives ${heard(real[0], b)})`);
}
if (fits.length !== 1) fails.push(`the puzzle has ${fits.length} answers: ${JSON.stringify(fits)}`);
console.log({ napkin: napkinRows.length, glenys, answer: fits });
if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log('rows: the story matches the plain hunt rule, and the puzzle has one answer (the four)');
