// The frozen kernel contract. Every assertion here pins a behaviour that a
// caller relies on byte-for-byte; a change that trips one is a MAJOR bump.
import assert from 'node:assert';
import {
  DEFAULT_SIGILS, rawOf, createCapture, extractBlocks,
  blocksOfType, inkOf, firstInkOf,
} from '../src/index.js';

export async function run() {
  // ── 1. RAW capture: backslash-escaped `//` must survive verbatim ──────
  // This is the whole reason cooked capture is banned.
  const escaped = 'oooOO`# FINK: https:\\/\\/example.com\\/x.fink.js`;';
  const eb = extractBlocks(escaped).blocks;
  assert.equal(eb.length, 1);
  assert.ok(eb[0].raw.includes('\\/\\/'), 'raw capture must preserve \\/ escaping');
  assert.ok(eb[0].raw.includes('https:\\/\\/example.com'), 'the escaped URL survives whole');

  // ── 2. media typing: oooOO built-in, OO(type) curried, OO() default ───
  const poly = [
    'oooOO`-> start`;',
    'OO("text/turtle")`@prefix foaf: <http://xmlns.com/foaf/0.1/> .`;',
    'OO()`plain fallback`;',
    'oooOO`=== start ===\nHello.\n-> END`;',
  ].join('\n');
  const pb = extractBlocks(poly).blocks;
  assert.deepEqual(pb.map((b) => b.mediaType),
    ['text/x-ink', 'text/turtle', 'text/plain', 'text/x-ink']);
  assert.deepEqual(pb.map((b) => b.index), [0, 1, 2, 3], 'index is monotonic, document order');

  // ── 3. inkOf: unique ink blocks, document order, REAL newline join ────
  const ink = inkOf(pb);
  assert.equal(ink, '-> start\n=== start ===\nHello.\n-> END');
  assert.ok(ink.includes(String.fromCharCode(10)), 'join uses a real newline (char 10)');
  assert.ok(!ink.includes('\\n'), 'join is NOT a literal backslash-n');

  // dedup: the same ink block twice collapses to one
  const dup = extractBlocks('oooOO`same`; oooOO`same`; oooOO`other`;').blocks;
  assert.equal(inkOf(dup), 'same\nother');

  // ── 4. firstInkOf: the first ink block only (browser single-block) ────
  assert.equal(firstInkOf(pb), '-> start');
  assert.equal(firstInkOf(extractBlocks('OO("text/turtle")`t`; oooOO`i`;').blocks), 'i',
    'firstInkOf skips non-ink blocks to the first ink one');
  assert.equal(firstInkOf([]), '');

  // ── 5. defensive stringify: null/undefined → '' (never "undefined") ───
  assert.equal(rawOf(null), '');
  assert.equal(rawOf(undefined), '');
  assert.equal(rawOf('bare'), 'bare');
  assert.equal(rawOf({ raw: ['a', 'b'] }), 'ab');
  const nulled = extractBlocks('oooOO(null);').blocks;
  assert.equal(nulled[0].raw, '', 'a sigil invoked with null captures "" not "undefined"');

  // ── 6. a source that throws AFTER its sigils still yields the blocks ──
  const throwy = extractBlocks('oooOO`-> a`; window.document.title = "boom";').blocks;
  assert.equal(inkOf(throwy), '-> a', 'window-touch throws post-capture; blocks stand');

  // ── 7. no sigils → no blocks; non-string → TypeError ──────────────────
  assert.deepEqual(extractBlocks('const x = 1 + 1;').blocks, []);
  assert.throws(() => extractBlocks(42), TypeError);

  // ── 8. createCapture is the pure kernel: install + run + read ─────────
  const { globals, blocks } = createCapture();
  // simulate the isolate calling the installed sigil as a tagged template
  globals.oooOO(Object.assign(['x'], { raw: ['x'] }));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].mediaType, 'text/x-ink');
  assert.ok(DEFAULT_SIGILS instanceof Map && DEFAULT_SIGILS.get('oooOO') === 'text/x-ink');

  // ── 9. blocksOfType filters, preserving order ─────────────────────────
  assert.equal(blocksOfType(pb, 'text/x-ink').length, 2);
  assert.equal(blocksOfType(pb, 'text/turtle').length, 1);

  console.log('kernel.test.js ok');
}
