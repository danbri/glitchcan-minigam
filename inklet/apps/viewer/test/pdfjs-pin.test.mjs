// The vendored pdf.js files are the ones recorded in third_party/pdfjs/README.md, byte for byte.
// Run: npm run test:viewer. Why: https://github.com/danbri/glitchcan-minigam/issues/1171
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const dir = new URL('../../../../third_party/pdfjs/', import.meta.url);
const readme = readFileSync(new URL('README.md', dir), 'utf8');
const pins = [...readme.matchAll(/^\| `([^`]+\.mjs)` \| `([0-9a-f]{64})` \|$/gm)].map((m) => [m[1], m[2]]);

test('the README pins both pdf.js files', () => {
  assert.deepEqual(pins.map(([f]) => f).sort(), ['pdf.min.mjs', 'pdf.worker.min.mjs']);
});

for (const [file, want] of pins) {
  test(`${file} is the pinned file`, () => {
    const got = createHash('sha256').update(readFileSync(new URL(file, dir))).digest('hex');
    assert.equal(got, want, `${file} changed: update it only with its tarball check and the table`);
  });
}
