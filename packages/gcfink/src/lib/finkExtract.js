// FINK extraction for Node/browser-adjacent use (no network required).
// Back-compat facade over the typed sigil capture in sigils.js: same
// signature, same output (unique Ink blocks, document order, newline
// joined) as the original single-sigil extractor.

import { extractBlocks, inkOf } from './sigils.js';

export function extractFinkFromJsSource(jsSource) {
  const { blocks } = extractBlocks(jsSource);
  return inkOf(blocks);
}
