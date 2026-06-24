// io-html.js — full standalone HTML document import/export.
// Export wraps the document body in a minimal, self-styled page so the
// file reads sensibly in any browser. Import extracts and sanitizes body.

import { sanitizeHtml } from './document-model.js';

export function htmlToDocument(fullHtml) {
  const doc = new DOMParser().parseFromString(fullHtml, 'text/html');
  return sanitizeHtml(doc.body ? doc.body.innerHTML : fullHtml);
}

// Common RDFa prefixes declared on the root so authored semantic markup
// (property="schema:name", typeof="foaf:Person", …) resolves in consumers.
const RDFA_PREFIXES = 'schema: https://schema.org/ dc: http://purl.org/dc/terms/ ' +
  'foaf: http://xmlns.com/foaf/0.1/ skos: http://www.w3.org/2004/02/skos/core# ' +
  'owl: http://www.w3.org/2002/07/owl# rdfs: http://www.w3.org/2000/01/rdf-schema#';

const DOC_CSS = `
  :root { color-scheme: light dark; }
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 46rem;
         margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1c1c1c; }
  /* Per-paragraph bidi: each block detects its own base direction so mixed
     LTR/RTL documents render and align correctly (matches the editor). */
  body > * { unicode-bidi: plaintext; text-align: start; }
  h1,h2,h3 { line-height: 1.25; }
  blockquote { border-left: 4px solid #8b4513; margin: 0 0 1em; padding: 0.2em 1em; color: #555; }
  pre { background: #f4f4f2; padding: 0.8em; border-radius: 6px; overflow: auto; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; }
  a { color: #1a73e8; }
  img { max-width: 100%; height: auto; }
  figure { margin: 0 0 1em; text-align: center; }
  figcaption { font-size: 0.85em; color: #555; }
  table { border-collapse: collapse; margin: 0 0 1em; max-width: 100%; }
  td, th { border: 1px solid #d9d6cf; padding: 0.3em 0.55em; vertical-align: top; text-align: left; }
  th { background: #f4f4f2; }
  [property], [typeof] { } /* semantic spans render inline, unstyled by default */`;

/**
 * Export a standalone HTML5+RDFa document with embedded CSS.
 * @param {string} bodyHtml      sanitized document body (RDFa attrs preserved)
 * @param {string} title
 * @param {object} [opts]
 * @param {boolean} [opts.externalCss]  link "<title>.css" instead of embedding
 */
export function documentToHtml(bodyHtml, title = 'Document', opts = {}) {
  const safeTitle = title.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const styleTag = opts.externalCss
    ? `<link rel="stylesheet" href="${cssFilename(title)}">`
    : `<style>${DOC_CSS}</style>`;
  return `<!DOCTYPE html>
<html lang="en" prefix="${RDFA_PREFIXES}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="edot">
<title property="dc:title">${safeTitle}</title>
${styleTag}
</head>
<body vocab="https://schema.org/" typeof="CreativeWork">
${bodyHtml}
</body>
</html>
`;
}

/** The shared stylesheet, for standalone .css export. */
export function documentCss() {
  return `/* edot document stylesheet */${DOC_CSS}\n`;
}

export function cssFilename(title) {
  return (title || 'document').replace(/[\/\\:*?"<>|]+/g, '_').slice(0, 80) + '.css';
}
