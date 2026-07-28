// Typed sigil capture — now the frozen @foafos/backticks kernel.
//
// This logic used to live here AND, hand-copied, inside the browser
// sandbox's iframe srcdoc. Two copies of a security-relevant primitive had
// already diverged (null-handling; all-blocks vs unique-join). They are now
// one audited, frozen module; this file is a thin re-export so every
// existing finkcore import path keeps working unchanged.
//
// See packages/backticks/FROZEN.md for the contract, and
// docs/fink-story-sandbox-threatmodel-20260728.md for why the capture step
// is isolated by the CALLER (iframe / vm), not by this module.

// Node context → import from the node adapter, which re-exports the whole
// pure kernel plus extractBlocks (the node:vm isolate).
export {
  DEFAULT_SIGILS,
  extractBlocks,
  blocksOfType,
  inkOf,
  rawOf,
  createCapture,
  firstInkOf,
} from '../../../backticks/src/node.js';
