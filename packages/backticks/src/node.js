// @foafos/backticks/node — the Node isolation adapter.
//
// The pure kernel (./index.js) is browser-safe and carries no isolation.
// This file adds `extractBlocks`, which runs a .fink.js in a node:vm
// context. It is kept OUT of index.js so a browser (the boxed story
// runner) can import the kernel without a bare `import 'node:vm'` throwing
// at module load.
//
// node:vm is NOT a hard security boundary — a determined source can reach
// out of it — which is why this is a THIN adapter and the trust boundary
// for genuinely untrusted input stays with the caller's isolate (an
// opaque-origin iframe for the live player). See FROZEN.md.

import vm from 'node:vm';
import { createCapture, DEFAULT_SIGILS } from './index.js';

// Re-export the whole kernel so a Node caller can import everything from
// one place (finkcore does).
export * from './index.js';

/**
 * Run a .fink.js source in a node:vm context with the capture globals
 * installed, and return the captured blocks.
 *
 * @param {string} jsSource
 * @param {object} [opts]
 * @param {Map<string,string>|Object} [opts.sigils]
 * @param {number} [opts.timeout] vm timeout ms (default 2000)
 * @returns {{ blocks: Array<{sigil,mediaType,raw,index}> }}
 */
export function extractBlocks(jsSource, opts = {}) {
  if (typeof jsSource !== 'string') throw new TypeError('jsSource must be a string');
  const { globals, blocks } = createCapture(opts.sigils ?? DEFAULT_SIGILS);
  const context = vm.createContext({ ...globals }, { name: 'backticks-extract' });
  try {
    new vm.Script(jsSource, { filename: 'input.fink.js' })
      .runInContext(context, { timeout: opts.timeout ?? 2000 });
  } catch {
    // Sources that touch window/document throw AFTER their sigil calls
    // ran — the captured blocks are still good.
  }
  return { blocks };
}
