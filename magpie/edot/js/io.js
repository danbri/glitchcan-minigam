// io.js — format registry + file open/save orchestration.
// Maps file extensions to import/export functions, routing exotic formats
// through the LibreOffice WASM bridge when available and falling back to the
// native handlers otherwise.

import { toPlainText, normalize } from './document-model.js';
import { markdownToHtml, htmlToMarkdown } from './io-markdown.js';
import { htmlToDocument, documentToHtml, documentCss } from './io-html.js';
import { htmlToDocx, docxToHtml } from './io-docx.js';
import { htmlToPdf } from './io-pdf.js';
import * as LO from './libreoffice-bridge.js';

// Native handlers keyed by extension.
const NATIVE = {
  txt: {
    label: 'Plain text',
    accept: '.txt,text/plain',
    import: async (file) => normalize(escapeToHtml(await file.text())),
    export: (html) => new Blob([toPlainText(html)], { type: 'text/plain' }),
  },
  md: {
    label: 'Markdown',
    accept: '.md,.markdown,text/markdown',
    import: async (file) => markdownToHtml(await file.text()),
    export: (html) => new Blob([htmlToMarkdown(html)], { type: 'text/markdown' }),
  },
  html: {
    label: 'HTML',
    accept: '.html,.htm,text/html',
    import: async (file) => htmlToDocument(await file.text()),
    export: (html, title) => new Blob([documentToHtml(html, title)], { type: 'text/html' }),
  },
  docx: {
    label: 'Word (.docx)',
    accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    import: async (file) => docxToHtml(await file.arrayBuffer()),
    export: (html, title) => htmlToDocx(html, title), // returns Promise<Blob>
  },
  pdf: {
    label: 'PDF',
    accept: '.pdf,application/pdf',
    exportOnly: true,
    export: (html, title) => htmlToPdf(html, title),
  },
  css: {
    label: 'Stylesheet (.css)',
    accept: '.css,text/css',
    exportOnly: true,
    export: () => new Blob([documentCss()], { type: 'text/css' }),
  },
};

// Extensions handled only by LibreOffice WASM. Listed so the UI can offer
// them and produce a helpful message when no backend is configured.
const WASM_FORMATS = {
  odt: { label: 'OpenDocument (.odt)', accept: '.odt' },
  doc: { label: 'Word 97–2003 (.doc)', accept: '.doc' },
  rtf: { label: 'Rich Text (.rtf)', accept: '.rtf' },
};

function escapeToHtml(text) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

export function extOf(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : '';
}

export function importAccept() {
  const exts = [
    ...Object.values(NATIVE).filter((f) => !f.exportOnly),
    ...Object.values(WASM_FORMATS),
  ].map((f) => f.accept);
  return exts.join(',');
}

export function exportFormats() {
  return [
    ...Object.entries(NATIVE).map(([ext, f]) => ({ ext, label: f.label })),
    { ext: 'odt', label: WASM_FORMATS.odt.label, wasm: true },
    { ext: 'rtf', label: WASM_FORMATS.rtf.label, wasm: true },
  ];
}

/** Read a File into document HTML. */
export async function importFile(file) {
  const ext = extOf(file.name);
  const native = NATIVE[ext];

  // Try LibreOffice for formats the native path can't do, or as an upgrade
  // for docx when a backend is configured (better fidelity).
  if ((!native || ext === 'docx') && LO.isConfigured()) {
    try {
      const out = await LO.convert(await file.arrayBuffer(), ext, 'docx');
      return docxToHtml(out.buffer || out);
    } catch (err) {
      if (err.code !== 'NO_BACKEND' && native) {
        // backend present but failed — fall through to native if possible
        console.warn('LibreOffice import failed, using native path', err);
      } else if (!native) {
        throw new Error(`${ext.toUpperCase()} import needs the LibreOffice WASM backend. ` +
          'See README → "LibreOffice WASM bridge".');
      }
    }
  }

  if (native) return normalize(await native.import(file));
  throw new Error(`Unsupported format: .${ext}`);
}

/** Produce a downloadable Blob in the requested format. */
export async function exportDocument(html, title, ext) {
  const native = NATIVE[ext];
  if (native) {
    const blob = await native.export(normalize(html), title);
    return blob;
  }
  // WASM-only export: build a docx natively, then convert it.
  if (LO.isConfigured()) {
    const docx = await htmlToDocx(normalize(html), title);
    const bytes = new Uint8Array(await docx.arrayBuffer());
    const out = await LO.convert(bytes, 'docx', ext);
    return new Blob([out], { type: mimeFor(ext) });
  }
  throw new Error(`Exporting .${ext} needs the LibreOffice WASM backend. ` +
    'See README → "LibreOffice WASM bridge".');
}

function mimeFor(ext) {
  return {
    pdf: 'application/pdf',
    odt: 'application/vnd.oasis.opendocument.text',
    rtf: 'application/rtf',
    doc: 'application/msword',
  }[ext] || 'application/octet-stream';
}

// Text formats that can be re-exported to a string (for git save-back / diff).
export const TEXT_FORMATS = new Set(['txt', 'md', 'markdown', 'html', 'htm', 'css']);
export function isTextFormat(ext) { return TEXT_FORMATS.has((ext || '').toLowerCase()); }

/**
 * Re-export document HTML to the given *text* format as a string. Used by the
 * git save-back path to produce the file content to commit and diff.
 */
export async function exportText(html, title, ext) {
  const e = ext === 'markdown' ? 'md' : ext === 'htm' ? 'html' : ext;
  if (!isTextFormat(ext)) throw new Error(`.${ext} is a binary format — text save-back only`);
  const blob = await exportDocument(html, title, e);
  return blob.text();
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
