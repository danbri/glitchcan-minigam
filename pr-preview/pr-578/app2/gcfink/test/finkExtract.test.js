import { strict as assert } from 'node:assert';
import { extractFinkFromJsSource } from '../src/lib/finkExtract.js';

export async function run() {
  const source = [
    '// minimal fink file',
    'oooOO`',
    '# BASEHREF: media/demo/',
    '-> start',
    '',
    '=== start ===',
    'Hello, world.',
    '* [Ok] -> end',
    '`'
  ].join('\n');

  const ink = extractFinkFromJsSource(source);
  assert.ok(ink.includes('BASEHREF: media/demo/'));
  assert.ok(ink.includes('=== start ==='));
  assert.ok(ink.includes('* [Ok]'));

  // Multiple oooOO captures are deduped and joined
  const multi = ['oooOO`A`', 'oooOO`B`', 'oooOO`A`'].join('\n');
  const out = extractFinkFromJsSource(multi);
  assert.equal(out.replace(/\n/g, ''), 'AB');
}
