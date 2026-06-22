// io-html.js — full standalone HTML document import/export.
// Export wraps the document body in a minimal, self-styled page so the
// file reads sensibly in any browser. Import extracts and sanitizes body.

import { sanitizeHtml } from './document-model.js';

export function htmlToDocument(fullHtml) {
  const doc = new DOMParser().parseFromString(fullHtml, 'text/html');
  return sanitizeHtml(doc.body ? doc.body.innerHTML : fullHtml);
}

export function documentToHtml(bodyHtml, title = 'Document') {
  const safeTitle = title.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 46rem;
         margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1c1c1c; }
  h1,h2,h3 { line-height: 1.25; }
  blockquote { border-left: 4px solid #8b4513; margin: 0 0 1em; padding: 0.2em 1em; color: #555; }
  pre { background: #f4f4f2; padding: 0.8em; border-radius: 6px; overflow: auto; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; }
  a { color: #1a73e8; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}
