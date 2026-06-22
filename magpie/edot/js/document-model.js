// document-model.js — the canonical representation is sanitized HTML.
// All import paths normalize *into* this shape and export paths read *from*
// it, so formats never talk to each other directly.

// Tags we allow inside the editable surface. Anything else is unwrapped
// (children kept) or dropped. Keeps pasted Word/web content from injecting
// scripts, styles, and layout cruft.
const ALLOWED = new Set([
  'P', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE',
  'A', 'HR', 'SPAN',
  // Tables, images and figures (imported from .docx / pasted from the web).
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION',
  'COLGROUP', 'COL', 'IMG', 'FIGURE', 'FIGCAPTION',
]);

const ALLOWED_ATTR = {
  A: ['href', 'title'],
  SPAN: [],   // span kept only as a transparent wrapper; attrs stripped
  IMG: ['src', 'alt', 'width', 'height'],
  TD: ['colspan', 'rowspan'],
  TH: ['colspan', 'rowspan', 'scope'],
  COL: ['span', 'width'],
};

// RDFa Lite + Core attributes are preserved on *any* allowed element so
// semantic markup survives editing, paste, and round-trips. (This is a
// deliberate, document-meaningful exception to the otherwise strict
// attribute allow-list — the wider project is RDF-centric.)
const RDFA_ATTR = new Set([
  'vocab', 'typeof', 'property', 'resource', 'about', 'prefix',
  'content', 'datatype', 'rel', 'rev', 'inlist', 'src', 'href', 'lang',
]);

// Elements whose *contents* are dangerous or meaningless as document text —
// remove them outright rather than unwrapping (which would leak script/CSS
// source into the body as visible text).
const DROP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'LINK', 'META', 'HEAD', 'TITLE']);

// Keep only `text-align: left|right|center|justify` from a style string.
function filterStyle(value) {
  const m = /text-align\s*:\s*(left|right|center|justify)/i.exec(value || '');
  return m ? `text-align: ${m[1].toLowerCase()}` : '';
}

function sanitizeNode(node, doc) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName;
      if (DROP.has(tag)) {
        node.removeChild(child);
        continue;
      }
      if (!ALLOWED.has(tag)) {
        // Unwrap unknown elements, keeping their (sanitized) children.
        sanitizeNode(child, doc);
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        node.removeChild(child);
        continue;
      }
      // Strip every attribute except the explicit allow-list + RDFa.
      const keep = ALLOWED_ATTR[tag] || [];
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (name === 'style') {
          // Allow a tightly constrained style: text-align only. Everything
          // else (colors, positioning, fonts injected by paste) is dropped.
          const filtered = filterStyle(attr.value);
          if (filtered) child.setAttribute('style', filtered);
          else child.removeAttribute('style');
        } else if (keep.includes(name) || RDFA_ATTR.has(name)) {
          // Defang any URL-bearing attribute carrying javascript:.
          if ((name === 'href' || name === 'src' || name === 'resource' || name === 'about') &&
              /^\s*javascript:/i.test(attr.value)) {
            child.removeAttribute(attr.name);
          }
          // img/src: permit only image data URLs, http(s), and relative paths.
          if (name === 'src' && /^\s*data:/i.test(attr.value) &&
              !/^\s*data:image\//i.test(attr.value)) {
            child.removeAttribute(attr.name);
          }
        } else {
          child.removeAttribute(attr.name);
        }
      }
      // Defang links: block javascript: and force safe rel on external.
      if (tag === 'A') {
        const href = child.getAttribute('href') || '';
        if (/^\s*javascript:/i.test(href)) child.removeAttribute('href');
        if (/^https?:/i.test(href)) {
          child.setAttribute('rel', 'noopener noreferrer');
          child.setAttribute('target', '_blank');
        }
      }
      sanitizeNode(child, doc);
    } else if (child.nodeType === Node.COMMENT_NODE) {
      node.removeChild(child);
    }
  }
}

/** Sanitize an untrusted HTML string into safe document HTML. */
export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  sanitizeNode(doc.body, doc);
  return doc.body.innerHTML;
}

/** Ensure the editable surface always has at least one block element. */
export function normalize(html) {
  const clean = sanitizeHtml(html).trim();
  if (!clean) return '<p><br></p>';
  // Bare text/inline content gets wrapped so the caret has a home block.
  if (!/^<(p|h[1-6]|ul|ol|blockquote|pre|hr)/i.test(clean)) {
    return `<p>${clean}</p>`;
  }
  return clean;
}

/** Plain-text projection used for word/char counts and .txt export. */
export function toPlainText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Insert newlines at block boundaries before reading textContent.
  doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,br,hr')
    .forEach((el) => el.appendChild(doc.createTextNode('\n')));
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export function stats(html) {
  const text = toPlainText(html);
  const words = text ? (text.match(/\S+/g) || []).length : 0;
  const chars = text.length;
  const paragraphs = text ? text.split(/\n{2,}/).filter((s) => s.trim()).length : 0;
  return { words, chars, paragraphs };
}
