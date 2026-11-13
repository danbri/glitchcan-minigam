// Viewer: shows one file that the parent frame hands it. https://github.com/danbri/glitchcan-minigam/issues/1171
// Design and limits: docs/foafos-viewer-20261113.md.
//
// The Viewer has no foafos bridge and asks for nothing. Its parent (Files) embeds it in a frame with
// sandbox="allow-scripts" only, and this page's CSP has connect-src 'none'. So code that runs here
// (pdf.js, or a fault in it that a hostile PDF finds) can read the bytes it was given and draw them,
// and can send messages to its parent. It cannot reach the pod, the shell or the network.
//
// Messages, all through window.postMessage:
//   Viewer → parent  { kind: 'viewer-ready' }                         once, when it can take a file
//   parent → Viewer  { kind: 'viewer-show', name, type, bytes }       bytes: an ArrayBuffer
//   Viewer → parent  { kind: 'viewer-state', shown, page, pages, ink, error }
// The parent must treat every 'viewer-state' as untrusted data: numbers and short text, to show.

const view = document.getElementById('view');
const MAX_BYTES = 64 * 1024 * 1024;          // the same order as the pod's own "too-large"
let pdfjs = null;
let current = null;                          // the blob: URL on show, released when another comes

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) el.append(k);
  return el;
};

function tell(state) {
  // The parent's origin is opaque (a sandboxed frame), so no target origin can name it: '*'.
  // Only small values go out, never the bytes.
  window.parent.postMessage({ kind: 'viewer-state', ...state }, '*');
}

function clear() {
  if (current) URL.revokeObjectURL(current);
  current = null;
  view.replaceChildren();
}

async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  const base = new URL('../../../third_party/pdfjs/', location.href);
  const lib = await import(new URL('pdf.min.mjs', base).href);
  // A frame with no origin of its own cannot start pdf.js's worker from this site, so pdf.js runs
  // the worker's code on this page. The CSP allows scripts from this site only.
  lib.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', base).href;
  pdfjs = lib;
  return lib;
}

function darkPixels(canvas) {
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let dark = 0;
  for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 0 && d[k] < 128) dark++;
  return dark;
}

async function showPdf(bytes, name) {
  const canvas = h('canvas', { class: 'pdf-page', 'aria-label': `${name}, page 1` });
  const where = h('span', { class: 'pdf-where' }, 'Opening…');
  const prev = h('button', { type: 'button', disabled: true }, 'Previous page');
  const next = h('button', { type: 'button', disabled: true }, 'Next page');
  view.append(canvas, h('div', { class: 'pdf-nav' }, prev, where, next));
  try {
    const lib = await loadPdfjs();
    // No eval, no XFA forms, no scripts in the PDF: pdf.js's own switches, set to the safe side.
    const doc = await lib.getDocument({
      data: new Uint8Array(bytes), isEvalSupported: false, enableXfa: false,
      useSystemFonts: false, stopAtErrors: false,
    }).promise;
    let at = 1;
    const show = async () => {
      const page = await doc.getPage(at);
      const width = Math.max(200, view.clientWidth - 16);
      const vp0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (width / vp0.width) * (window.devicePixelRatio || 1) });
      canvas.width = vp.width; canvas.height = vp.height;
      canvas.style.width = `${width}px`;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, canvas }).promise;
      where.textContent = `Page ${at} of ${doc.numPages}`;
      canvas.setAttribute('aria-label', `${name}, page ${at} of ${doc.numPages}`);
      prev.disabled = at <= 1; next.disabled = at >= doc.numPages;
      tell({ shown: 'pdf', page: at, pages: doc.numPages, ink: darkPixels(canvas) });
    };
    prev.addEventListener('click', () => { if (at > 1) { at--; show(); } });
    next.addEventListener('click', () => { if (at < doc.numPages) { at++; show(); } });
    await show();
  } catch (err) {
    where.textContent = 'This PDF could not be shown here.';
    tell({ shown: 'pdf', error: String(err?.message || err).slice(0, 200) });
  }
}

async function showFile({ name, type, bytes }) {
  clear();
  name = String(name || 'file').slice(0, 200);
  type = String(type || '').toLowerCase();
  if (!(bytes instanceof ArrayBuffer)) { view.append(h('p', { class: 'none' }, 'Nothing to show.')); tell({ error: 'no-bytes' }); return; }
  if (bytes.byteLength > MAX_BYTES) { view.append(h('p', { class: 'none' }, 'This file is too large to show here.')); tell({ error: 'too-large' }); return; }
  if (type === 'application/pdf') return showPdf(bytes, name);
  if (/^(image|audio|video)\//.test(type) && !/svg/.test(type)) {
    current = URL.createObjectURL(new Blob([bytes], { type }));
    const el = type.startsWith('image/') ? h('img', { src: current, alt: name })
      : type.startsWith('audio/') ? h('audio', { controls: true, src: current, preload: 'metadata', 'aria-label': `Play ${name}` })
      : h('video', { controls: true, src: current, preload: 'metadata', playsInline: true, 'aria-label': `Play ${name}` });
    view.append(el);
    tell({ shown: type.split('/')[0] });
    return;
  }
  if (/^text\//.test(type) || type === 'application/json') {
    // As text, never as markup.
    view.append(h('pre', {}, new TextDecoder().decode(bytes)));
    tell({ shown: 'text' });
    return;
  }
  view.append(h('p', { class: 'none' }, 'This kind of file has no preview here.'));
  tell({ shown: 'none' });
}

window.addEventListener('message', (e) => {
  // Only the frame that holds this one may hand it a file.
  if (e.source !== window.parent || e.data?.kind !== 'viewer-show') return;
  showFile(e.data);
});
window.parent.postMessage({ kind: 'viewer-ready' }, '*');
