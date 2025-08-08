// FINK extraction for Node/browser-adjacent use (no network required)
// Strategy: Evaluate provided JS source with a sandboxed tag function `oooOO`
// that captures template literal strings and returns concatenated Ink content.

import vm from 'node:vm';

export function extractFinkFromJsSource(jsSource) {
  if (typeof jsSource !== 'string') throw new TypeError('jsSource must be a string');

  const captured = [];

  // Minimal sandbox with only the tag function
  const sandbox = {
    oooOO(strings) {
      try {
        const content = (strings && Array.isArray(strings.raw)) ? strings.raw.join('') : String(strings || '');
        captured.push(content);
        return content;
      } catch (e) {
        // Swallow errors, but keep going
        return '';
      }
    }
  };

  const context = vm.createContext(sandbox, { name: 'gcfink-fink-extract' });
  try {
    const script = new vm.Script(jsSource, { filename: 'input.fink.js' });
    script.runInContext(context, { timeout: 2000 });
  } catch (e) {
    // If source throws (e.g., references window/document), ignore; we only need the template literal
  }

  // Join unique blocks preserving order
  const unique = [];
  const seen = new Set();
  for (const s of captured) {
    if (!seen.has(s)) { unique.push(s); seen.add(s); }
  }
  return unique.join('\n');
}

