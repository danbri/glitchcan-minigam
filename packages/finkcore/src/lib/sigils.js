// Typed sigil capture: a .fink.js file is a polyglot document — executable
// JS whose only job is to hand typed text blocks to whoever is listening.
// `oooOO` is the sigil whose media type happens to be Ink; everything else
// arrives either through a registered named sigil or through the curried
// escape hatch OO('media/type')`...`.
//
// Capture is ALWAYS raw (strings.raw): authors escape `//` in Ink tag
// values as `\/\/`, and only raw capture preserves those backslashes for
// the Ink compiler to unescape. Cooked capture would silently break every
// absolute URL in the corpus. (See INK-GOTCHAS.md and the fink spec.)

import vm from 'node:vm';

/** The one binding the core ships. Everything else is the host's choice. */
export const DEFAULT_SIGILS = new Map([['oooOO', 'text/x-ink']]);

const rawOf = (strings) =>
  (strings && Array.isArray(strings.raw)) ? strings.raw.join('') : String(strings ?? '');

/**
 * Execute a .fink.js source in an isolated vm and capture every typed
 * block, in document order.
 *
 * @param {string} jsSource
 * @param {object} [opts]
 * @param {Map<string,string>} [opts.sigils] name → media type (defaults to DEFAULT_SIGILS)
 * @param {number} [opts.timeout] vm timeout ms (default 2000)
 * @returns {{ blocks: Array<{sigil:string, mediaType:string, raw:string, index:number}> }}
 */
export function extractBlocks(jsSource, opts = {}) {
  if (typeof jsSource !== 'string') throw new TypeError('jsSource must be a string');
  const sigils = opts.sigils ?? DEFAULT_SIGILS;
  const blocks = [];

  const capture = (sigil, mediaType) => (strings) => {
    const raw = rawOf(strings);
    blocks.push({ sigil, mediaType, raw, index: blocks.length });
    return raw;
  };

  const sandbox = {};
  for (const [name, mediaType] of sigils) sandbox[name] = capture(name, mediaType);
  // the curried escape hatch: any media type, no registry edit required
  sandbox.OO = (mediaType) => capture('OO', String(mediaType || 'text/plain'));

  const context = vm.createContext(sandbox, { name: 'gcfink-sigil-extract' });
  try {
    const script = new vm.Script(jsSource, { filename: 'input.fink.js' });
    script.runInContext(context, { timeout: opts.timeout ?? 2000 });
  } catch {
    // sources that touch window/document throw after their sigil calls
    // ran — the captured blocks are still good
  }
  return { blocks };
}

/** All blocks of one media type, in order. */
export function blocksOfType(blocks, mediaType) {
  return blocks.filter(b => b.mediaType === mediaType);
}

/**
 * Legacy view: the Ink content as the original single-string extraction
 * produced it — unique blocks, document order, newline-joined. This is
 * the back-compat contract for every existing caller.
 */
export function inkOf(blocks) {
  const unique = [];
  const seen = new Set();
  for (const b of blocksOfType(blocks, 'text/x-ink')) {
    if (!seen.has(b.raw)) { unique.push(b.raw); seen.add(b.raw); }
  }
  return unique.join('\n');
}
