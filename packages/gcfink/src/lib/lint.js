// Authoring lints for Ink/FINK sources — the ones that bite for real.

/**
 * Warn about unescaped `//` inside tag values. The Ink compiler treats
 * `//` as a comment even inside a `# TAG: value`, so `# FINK: https://x`
 * silently truncates to `https:` — which then resolves back to the
 * CURRENT story URL and reloads it. Authors must write `https:\/\/x`.
 * (Empirically verified against the vendored ink-full.js, 2026-07.)
 *
 * @param {string} inkSource
 * @returns {Array<{line:number, text:string, message:string}>}
 */
export function lintTagUrls(inkSource) {
  const warnings = [];
  const lines = String(inkSource).split('\n');
  lines.forEach((text, i) => {
    const hash = text.indexOf('#');
    if (hash < 0) return;
    const tagPart = text.slice(hash);
    // an unescaped `//`: two slashes not preceded by a backslash
    const m = tagPart.match(/(^|[^\\/])\/\//);
    if (m) {
      warnings.push({
        line: i + 1,
        text: text.trim(),
        message: 'unescaped // inside a tag — the Ink compiler will truncate here; escape as \\/\\/',
      });
    }
  });
  return warnings;
}
