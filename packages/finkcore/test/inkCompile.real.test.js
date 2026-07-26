// Locks the empirical // -truncation findings as a regression test,
// against the REAL vendored compiler (third_party/ink/ink-full.js).
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { compileInk } from '../src/lib/inkEngine.js';

export async function run() {

  const require = createRequire(import.meta.url);
  const inkjs = require('../../../third_party/ink/ink-full.js');
  const impl = (src) => new inkjs.Compiler(src).Compile();

  const src = [
    '-> start',
    '=== start ===',
    'One. # FINK: https://example.com/story.fink.js',
    'Two. # FINK: relative/path.fink.js',
    'Three. # FINK: https:\\/\\/example.com\\/story.fink.js',
    '-> END',
  ].join('\n');

  const r = compileInk(src, { compilerImpl: impl });
  assert.equal(r.ok, true);
  const tags = [];
  while (r.story.canContinue) { r.story.Continue(); tags.push(r.story.currentTags.join('|')); }
  assert.equal(tags[0], 'FINK: https:', 'unescaped // must truncate (documented compiler behavior)');
  assert.equal(tags[1], 'FINK: relative/path.fink.js', 'relative paths survive');
  assert.equal(tags[2], 'FINK: https://example.com/story.fink.js', 'escaped absolute URLs survive whole');
  console.log('inkCompile.real.test.js ok');

}
