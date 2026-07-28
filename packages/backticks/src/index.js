// @foafos/backticks — the FINK sigil capture kernel.
//
// A .fink.js file is a polyglot: executable JavaScript whose only job is to
// hand typed text blocks to whoever installed the sigil functions. Those
// blocks arrive through TAGGED TEMPLATE LITERALS — the "backticks" — so
// `oooOO`…`` is a function call whose argument is the template's parts.
// This module is the ONE definition of that capture: the sigil table, the
// raw-preservation invariant, and the block assembly, shared by every
// environment that runs a .fink.js.
//
// ── WHAT THIS MODULE IS NOT ────────────────────────────────────────────
// It is NOT an isolation boundary. It does not sandbox the untrusted
// .fink.js. It supplies the capture semantics that run INSIDE an isolate
// the CALLER provides — an opaque-origin iframe in the browser, node:vm or
// a Worker in Node. The security contract is:
//
//   GIVEN isolation, capture is deterministic, raw-preserving, and free of
//   side effects beyond the blocks it returns.
//
// Isolation is the caller's; correctness is ours. See FROZEN.md.
//
// ── THE FROZEN CONTRACT (v1 — no change without a MAJOR bump) ───────────
//  1. Capture is RAW: `strings.raw.join('')`, never cooked. Authors escape
//     `//` in ink tag values as `\/\/`; only raw capture preserves the
//     backslashes the ink compiler later unescapes. Cooked capture
//     silently breaks every absolute URL in the corpus. (INK-GOTCHAS.md)
//  2. A non-template argument stringifies; null/undefined → '' — NEVER the
//     literal "undefined", which would poison ink source. (This unifies a
//     latent divergence: the old browser copy did `String(strings)`.)
//  3. `oooOO` → text/x-ink is the one built-in sigil. `OO(mediaType)` is
//     the curried escape hatch for any other media type.
//  4. inkOf: unique ink blocks, document order, joined by a REAL newline.
//     firstInkOf: the first ink block's raw text (the live browser
//     player's current single-block contract). Two contracts, both named,
//     so choosing between them is on the record and never an accident.
//
// This file is the PURE, BROWSER-SAFE kernel — no Node builtins — so the
// boxed browser runner imports it directly. The node:vm isolation adapter
// (`extractBlocks`) lives in ./node.js, imported only from Node.

/** The one binding the kernel ships. Everything else is the host's choice. */
export const DEFAULT_SIGILS = new Map([['oooOO', 'text/x-ink']]);

/** Accept the sigil table as a Map or a plain object; yield [name,type]. */
function sigilPairs(sigils) {
  if (sigils instanceof Map) return [...sigils.entries()];
  return Object.entries(sigils || {});
}

/**
 * The raw invariant, in one place. A tagged template hands us a `strings`
 * with a `.raw` array; anything else is stringified defensively.
 */
export function rawOf(strings) {
  if (strings && Array.isArray(strings.raw)) return strings.raw.join('');
  return strings == null ? '' : String(strings);
}

/**
 * Build a capture context: the sigil global functions to install, and the
 * live `blocks` array they append to. Install `globals` onto ANY isolate's
 * global object, run the .fink.js there, then read `blocks`. This is the
 * pure kernel — no isolation, no environment assumptions.
 *
 * @param {Map<string,string>|Object} [sigils]
 * @returns {{ globals: Object, blocks: Array<{sigil,mediaType,raw,index}> }}
 */
export function createCapture(sigils = DEFAULT_SIGILS) {
  const blocks = [];
  const make = (sigil, mediaType) => (strings) => {
    const raw = rawOf(strings);
    blocks.push({ sigil, mediaType, raw, index: blocks.length });
    return raw;
  };
  const globals = {};
  for (const [name, mediaType] of sigilPairs(sigils)) globals[name] = make(name, mediaType);
  // the curried escape hatch: any media type, no registry edit required
  globals.OO = (mediaType) => make('OO', String(mediaType || 'text/plain'));
  return { globals, blocks };
}

/** All blocks of one media type, in document order. */
export function blocksOfType(blocks, mediaType) {
  return blocks.filter((b) => b.mediaType === mediaType);
}

/**
 * Legacy single-string ink extraction: unique ink blocks, document order,
 * newline-joined. The '\n' is a REAL newline — the literal backslash-n
 * once broke every story with a silent "Loading…" hang (CLAUDE.md).
 */
export function inkOf(blocks) {
  const seen = new Set();
  const out = [];
  for (const b of blocksOfType(blocks, 'text/x-ink')) {
    if (!seen.has(b.raw)) { seen.add(b.raw); out.push(b.raw); }
  }
  return out.join('\n');
}

/**
 * The FIRST ink block only — the live browser player's current contract
 * (fink-sandbox consumes data[0]). Named so the divergence from inkOf is a
 * choice on the record, not an accident.
 */
export function firstInkOf(blocks) {
  const first = blocksOfType(blocks, 'text/x-ink')[0];
  return first ? first.raw : '';
}


/**
 * The browser/iframe capture installer, as a self-contained source STRING.
 *
 * The live sandbox injects THIS exact text into its opaque-origin iframe
 * instead of a hand-copied capture, so the browser and this kernel cannot
 * drift. It reads a `sigils` object (name → media type) and a `target`
 * (the iframe `window`), defines the sigil globals + `OO`, and returns a
 * `__backticksHarvest()` closure yielding { blocks, ink, firstInk }.
 *
 * Built by joining lines so no template-literal newline can sneak in, and
 * the one place a newline is emitted (the ink join) uses
 * String.fromCharCode(10) — NEVER a "\n"/"\\n" literal, the exact ambiguity
 * that has bitten this repo. Executed against the kernel in
 * test/browser-source.test.js to prove byte-for-byte equivalence.
 */
export const INSTALL_CAPTURE_SOURCE = [
  '(function installBackticksCapture(target, sigils) {',
  '  var blocks = [];',
  '  function rawOf(strings) {',
  '    if (strings && Array.isArray(strings.raw)) return strings.raw.join("");',
  '    return strings == null ? "" : String(strings);',
  '  }',
  '  function make(sigil, mediaType) {',
  '    return function (strings) {',
  '      var raw = rawOf(strings);',
  '      blocks.push({ sigil: sigil, mediaType: mediaType, raw: raw, index: blocks.length });',
  '      return raw;',
  '    };',
  '  }',
  '  var names = Object.keys(sigils || {});',
  '  for (var i = 0; i < names.length; i++) target[names[i]] = make(names[i], sigils[names[i]]);',
  '  target.OO = function (mediaType) { return make("OO", String(mediaType || "text/plain")); };',
  '  var NL = String.fromCharCode(10); // a real newline, immune to the \\n vs \\\\n trap',
  '  target.__backticksHarvest = function () {',
  '    var seen = {}, ink = [], firstInk = "", set = false;',
  '    for (var j = 0; j < blocks.length; j++) {',
  '      var b = blocks[j];',
  '      if (b.mediaType !== "text/x-ink") continue;',
  '      if (!set) { firstInk = b.raw; set = true; }',
  '      if (!Object.prototype.hasOwnProperty.call(seen, b.raw)) { seen[b.raw] = 1; ink.push(b.raw); }',
  '    }',
  '    return { blocks: blocks, ink: ink.join(NL), firstInk: firstInk };',
  '  };',
  '  return target.__backticksHarvest;',
  '})',
].join('\n');
