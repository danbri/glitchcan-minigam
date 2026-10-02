// Plays fixed routes through lockfourteen.ink with the real compiler and Story API, choosing by choice text, and
// checks the ending each route reaches. A route that cannot find its next choice fails and prints what was offered.
//   node cozyverse/mystery3/tools/route.mjs [--print]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const inkjs = createRequire(import.meta.url)('inkjs/full');
const here = dirname(fileURLToPath(import.meta.url));
const compiler = new inkjs.Compiler(readFileSync(join(here, '..', 'lockfourteen.ink'), 'utf8'));
const json = compiler.Compile().ToJson();
for (const w of compiler.warnings || []) console.log('warning:', w);
const print = process.argv.includes('--print');

// Friday: the lock cottage and the boat. Saturday: the office (post-mortem, then the second one), Annette, and the
// board. Sunday: the gate and Clive.
const day1 = ['Take the coffee', 'Ask him how a lock works', 'Walk up to lock fifteen', 'Look at the bag', 'Go to your car',
  'Walk up the flight', 'Sign for', 'Read the minutes', 'Leave',
  'Go down to the hire boat', 'Knock at the side hatch', 'Talk to the man on the roof', 'Show him something', "Maaike's photograph at 22:41", 'Leave',
  'Look at the board before bed', 'Lock fourteen full', 'How a lock works', 'Leave the board', 'Go to bed'];
const day2 = ["Go to the coroner's office", 'Take the call', 'Thank her', 'Talk to Sam', 'Leave',
  'Phone the coroner',
  'Call on Annette', 'Talk to Annette', 'Ask about Thursday', 'Ask to see the photographs', 'Ask about the gates', 'Leave',
  'Look at the board before bed', 'He drowned', 'Someone filled', 'The chained post', 'Two keys', 'Leave the board', 'Go to bed'];
const day3 = ['Go to the Navigation', 'Talk to the landlord', 'Ask what he saw', 'Leave',
  'Call on Clive', 'Talk to Clive', 'Show him something', 'Pete Garrow saw', 'Show him something', "Neville's photographs at 23:13", 'Ask to see the windlass', 'Leave',
  'Go to bed'];
const solve = ['Write the report', 'Unlawful killing', 'drowned when someone filled it', 'for the death', 'Clive Amory'];

const routes = {
  full: [...day1, ...day2, ...day3, ...solve],
  // the same reading without the second post-mortem
  thin: [...day1, ...day2.filter((c) => c !== 'Phone the coroner'), ...day3, ...solve],
  pushed: [...day1, ...day2, ...day3, 'Write the report', 'Unlawful killing', 'He was pushed', 'for the death', 'Clive Amory'],
  fraud: [...day1, ...day2, ...day3, 'Write the report', 'Accident', 'He fell into the empty lock and drowned', 'for the gate money'],
  kit: [...day1, ...day2, ...day3, 'Write the report', 'Unlawful killing', 'He was pushed', 'Kit Rowe'],
};
const want = { full: 'full', thin: 'thin', pushed: 'half', fraud: 'half', kit: 'wrong' };
let failed = 0;
for (const [name, moves] of Object.entries(routes)) {
  const s = new inkjs.Story(json);
  let i = 0, ok = true;
  const out = (t) => { if (print && name === 'full') process.stdout.write(t); };
  for (;;) {
    while (s.canContinue) out(s.Continue());
    const ch = s.currentChoices;
    if (!ch.length || ch.some((c) => c.text === 'Begin again')) break;
    if (i >= moves.length) { ok = false; console.log(`${name}: route ran out; offered`, ch.map((c) => c.text)); break; }
    const k = ch.findIndex((c) => c.text.startsWith(moves[i]) || c.text.includes(moves[i]));
    if (k < 0) { ok = false; console.log(`${name}: move ${i} "${moves[i]}" not offered; offered`, ch.map((c) => c.text)); break; }
    out(`  > ${ch[k].text}\n`);
    s.ChooseChoiceIndex(k); i++;
  }
  const e = s.variablesState.ending;
  const pass = ok && e === want[name];
  if (!pass) failed++;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}: ending ${JSON.stringify(e)}, cards ${s.EvaluateFunction('evidence')} of 3`);
}
process.exit(failed ? 1 : 0);
