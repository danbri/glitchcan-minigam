// run-tests.mjs — run every edot suite's headless test in sequence and print a
// single pass/fail summary. CI-readiness: one command for the whole suite.
//
//   node magpie/edot/run-tests.mjs            # all suites
//   node magpie/edot/run-tests.mjs data mail  # only matching suites
//
// Each suite is its own Node script that launches headless Chromium, prints
// ✅/❌ lines and exits non-zero on failure. We just orchestrate + tally.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// [label, relative-path-from-this-file]
const SUITES = [
  ['editor (smoke)', 'test-edot.mjs'],
  ['editor (e2e)', 'test-e2e.mjs'],
  ['editor (mobile)', 'test-mobile.mjs'],
  ['editor (component)', 'test-editor-component.mjs'],
  ['data-object', 'test-data-object.mjs'],
  ['object-index', 'test-object-index.mjs'],
  ['kernel', 'test-kernel.mjs'],
  ['workspace', 'test-workspace.mjs'],
  ['places', 'places/test-places.mjs'],
  ['place-input', 'places/test-place-input.mjs'],
  ['geo-formula', 'data/test-geo-formula.mjs'],
  ['derive-places', 'places/tools/test-derive-places.mjs'],
  ['data', 'data/test-data.mjs'],
  ['slides', 'slides/test-slides.mjs'],
  ['slides (samples)', 'slides/test-samples.mjs'],
  ['mail', 'mail/test-mail.mjs'],
  ['calendar', 'calendar/test-calendar.mjs'],
  ['maps', 'maps/test-maps.mjs'],
  ['maps-3d', 'maps/test-maps3d.mjs'],
  ['events-layer', 'maps/test-events-layer.mjs'],
  ['auth', 'auth/test-auth.mjs'],
  ['backup', 'backup/test-backup.mjs'],
];

const filter = process.argv.slice(2);
const suites = filter.length
  ? SUITES.filter(([label, f]) => filter.some((q) => label.includes(q) || f.includes(q)))
  : SUITES;

function run(label, rel) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn('node', [path.join(HERE, rel)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const grab = (buf) => { tail = (tail + buf.toString()).split('\n').filter(Boolean).slice(-1)[0] || tail; };
    child.stdout.on('data', grab);
    child.stderr.on('data', grab);
    child.on('close', (code) => {
      const secs = ((Date.now() - start) / 1000).toFixed(0);
      const ok = code === 0;
      console.log(`${ok ? '✅' : '❌'} ${label.padEnd(18)} ${String(secs).padStart(3)}s  ${tail.slice(0, 60)}`);
      resolve({ label, ok });
    });
  });
}

console.log(`Running ${suites.length} suite(s)…\n`);
const results = [];
for (const [label, rel] of suites) results.push(await run(label, rel)); // sequential — each owns a browser
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} suites passed.`);
if (failed.length) console.log('FAILED: ' + failed.map((r) => r.label).join(', '));
process.exit(failed.length ? 1 : 0);
