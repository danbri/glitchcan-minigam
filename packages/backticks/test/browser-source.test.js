// The browser installer (INSTALL_CAPTURE_SOURCE) is the exact text the live
// opaque-origin iframe will inject. It must produce byte-for-byte the same
// blocks as the Node kernel — otherwise "one frozen definition" is a lie
// and the sandbox rewire is unsafe. We execute the source here (in a plain
// Node function — NOT as a security test, as an EQUIVALENCE test) and
// compare against createCapture over the same fixtures.
import assert from 'node:assert';
import { createCapture, inkOf, firstInkOf, INSTALL_CAPTURE_SOURCE } from '../src/index.js';

// Evaluate the installer source once. In the browser this is `eval`'d
// inside the iframe; here `(0, eval)` runs it in this realm — fine, because
// the property under test is the CAPTURE LOGIC, not isolation.
const installer = (0, eval)(INSTALL_CAPTURE_SOURCE);

// Run a .fink.js body through the browser installer the way the iframe
// does: install sigils onto a target, execute the source with those names
// in scope, then harvest.
function browserExtract(jsSource, sigils = { oooOO: 'text/x-ink' }) {
  const target = {};
  const harvest = installer(target, sigils);
  // The iframe runs the file via new Function with the sigils as globals on
  // `window`; here we bind them as named parameters — same effect.
  const names = Object.keys(target).filter((k) => k !== '__backticksHarvest');
  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, jsSource);
  try { fn(...names.map((n) => target[n])); } catch { /* post-capture throw */ }
  return harvest();
}

// Run the SAME source through the Node kernel for comparison.
function kernelExtract(jsSource) {
  const { globals, blocks } = createCapture();
  const names = Object.keys(globals);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, jsSource);
  try { fn(...names.map((n) => globals[n])); } catch { /* post-capture throw */ }
  return { blocks, ink: inkOf(blocks), firstInk: firstInkOf(blocks) };
}

export async function run() {
  const fixtures = [
    'oooOO`-> start`;',
    'oooOO`-> a`; oooOO`-> a`; oooOO`-> b`;',                       // dedup
    'OO("text/turtle")`@prefix a: <x> .`; oooOO`-> only`;',        // typed + ink
    'oooOO`# FINK: https:\\/\\/example.com\\/x.fink.js`;',          // \\/ escaping
    'oooOO`line1\nline2`; window.document.title = "boom";',         // post-throw
    'const noop = 1;',                                             // no sigils
  ];

  for (const src of fixtures) {
    const b = browserExtract(src);
    const k = kernelExtract(src);
    assert.deepEqual(
      b.blocks.map(({ sigil, mediaType, raw, index }) => ({ sigil, mediaType, raw, index })),
      k.blocks,
      `browser blocks must equal kernel blocks for: ${JSON.stringify(src)}`);
    assert.equal(b.ink, k.ink, `browser ink must equal kernel ink for: ${JSON.stringify(src)}`);
    assert.equal(b.firstInk, k.firstInk, `browser firstInk must match for: ${JSON.stringify(src)}`);
  }

  // The trap, pinned directly: two distinct ink blocks join on a REAL
  // newline (char 10), never a literal backslash-n.
  const two = browserExtract('oooOO`A`; oooOO`B`;');
  assert.equal(two.ink, 'A' + String.fromCharCode(10) + 'B');
  assert.ok(!two.ink.includes('\\n'), 'browser ink join must not be a literal backslash-n');

  // \\/ escaping survives the browser path identically.
  const esc = browserExtract('oooOO`# FINK: https:\\/\\/x.com\\/y`;');
  assert.ok(esc.blocks[0].raw.includes('\\/\\/'), 'browser path preserves \\/ escaping');

  // dedup keys that collide with Object.prototype names must not corrupt
  // the seen-set (why the source uses hasOwnProperty, not `in`).
  const proto = browserExtract('oooOO`hasOwnProperty`; oooOO`hasOwnProperty`; oooOO`toString`;');
  assert.equal(proto.ink, 'hasOwnProperty' + String.fromCharCode(10) + 'toString',
    'prototype-named ink blocks dedup correctly');

  console.log('browser-source.test.js ok');
}
