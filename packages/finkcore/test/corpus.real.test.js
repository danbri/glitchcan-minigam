// The whole story corpus: every inklet/**/*.fink.js must extract via the
// sigil sandbox and compile with the REAL vendored ink compiler.
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { extractFinkFromJsSource } from '../src/lib/finkExtract.js';
import { compileInk } from '../src/lib/inkEngine.js';

const require = createRequire(import.meta.url);
const inkjs = require('../../../third_party/ink/ink-full.js');
const impl = (src) => new inkjs.Compiler(src).Compile();

// stories that are documented broken content (CLAUDE.md) — extraction
// must still work; compile failures here are tolerated, not asserted
const KNOWN_BROKEN = new Set([]);

export async function run() {
  const root = new URL('../../../inklet/', import.meta.url).pathname;
  const files = [];
  for (const dir of ['', 'demos/']) {
    for (const f of readdirSync(join(root, dir || '.')))
      if (f.endsWith('.fink.js') && !f.startsWith('_tmp')) files.push(join(root, dir, f));
  }
  assert.ok(files.length >= 8, `expected a corpus, found ${files.length}`);
  const failures = [];
  for (const file of files) {
    const short = file.slice(root.length);
    let ink = extractFinkFromJsSource(readFileSync(file, 'utf8'));
    if (!ink.trim()) { failures.push(`${short}: extraction empty`); continue; }
    // platform contract: the player injects a private _inventory knot
    // into every story (fink-ink-engine.js:100). Stories may divert to
    // it, so standalone compilation mirrors the contract with a stub.
    if (/->\s*_inventory/.test(ink)) ink += '\n=== _inventory ===\nstub.\n-> END\n';
    const r = compileInk(ink, { compilerImpl: impl });
    if (!r.ok && !KNOWN_BROKEN.has(short)) failures.push(`${short}: ${String(r.error).slice(0, 100)}`);
  }
  console.log(`corpus: ${files.length} fink files checked`);
  assert.deepEqual(failures, [], failures.join('\n'));
}
