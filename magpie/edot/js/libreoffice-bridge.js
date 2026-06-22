// libreoffice-bridge.js — high-fidelity conversion via LibreOffice compiled
// to WebAssembly (the ZetaOffice / zetajs project).
//
// WHY A BRIDGE, NOT A BUNDLE:
// A full LibreOffice WASM build is hundreds of megabytes — far too large to
// vendor in this repo or ship over GitHub Pages. So edot keeps the engine
// *pluggable*: the always-available native path (io-docx.js, io-markdown.js)
// covers the structural core offline, and THIS module activates a real
// LibreOffice backend when one is configured. That gives the full Office
// importer/exporter — tables, images, .doc/.odt/.rtf, PDF export — without
// forcing the weight on every visitor.
//
// CONFIGURING A BACKEND:
// Set a global before this module loads, e.g. in a <script> or via
// localStorage('edot.libreoffice.url'):
//
//   window.EDOT_LIBREOFFICE = {
//     // ES module exposing  async convert({ bytes, from, to }) => Uint8Array
//     moduleUrl: 'https://your-host/zeta/edot-lo-adapter.js',
//   };
//
// The adapter is expected to wrap zetajs's headless conversion. We keep the
// contract deliberately tiny so any LibreOffice-WASM distribution can be
// dropped in behind it.

let _backend = null;     // resolved adapter ({ convert })
let _loading = null;     // in-flight load promise (dedupe)
let _probed = false;

function readConfig() {
  if (typeof window === 'undefined') return null;
  if (window.EDOT_LIBREOFFICE && window.EDOT_LIBREOFFICE.moduleUrl) {
    return window.EDOT_LIBREOFFICE;
  }
  try {
    const url = localStorage.getItem('edot.libreoffice.url');
    if (url) return { moduleUrl: url };
  } catch (_) { /* storage blocked */ }
  return null;
}

/** True if a LibreOffice WASM backend is configured (not necessarily loaded). */
export function isConfigured() {
  return !!readConfig();
}

/** Lazily import and initialise the configured backend. Returns null if none. */
export async function ensureBackend() {
  if (_backend) return _backend;
  if (_probed && !readConfig()) return null;
  if (_loading) return _loading;

  const cfg = readConfig();
  _probed = true;
  if (!cfg) return null;

  _loading = (async () => {
    const mod = await import(/* @vite-ignore */ cfg.moduleUrl);
    const adapter = mod.default || mod;
    if (typeof adapter.convert !== 'function') {
      throw new Error('LibreOffice adapter must export convert({bytes,from,to})');
    }
    if (typeof adapter.init === 'function') await adapter.init(cfg);
    _backend = adapter;
    return adapter;
  })().catch((err) => {
    _loading = null;
    throw err;
  });

  return _loading;
}

/**
 * Convert document bytes between formats using LibreOffice WASM.
 * @param {Uint8Array|ArrayBuffer} bytes  source document
 * @param {string} from  source extension, e.g. 'docx', 'odt', 'doc', 'rtf'
 * @param {string} to    target extension, e.g. 'docx', 'pdf', 'html', 'odt'
 * @returns {Promise<Uint8Array>}
 * @throws if no backend is configured (callers should fall back to native I/O)
 */
export async function convert(bytes, from, to) {
  const backend = await ensureBackend();
  if (!backend) {
    const e = new Error('LibreOffice WASM backend not configured');
    e.code = 'NO_BACKEND';
    throw e;
  }
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return backend.convert({ bytes: input, from, to });
}

// Formats only the WASM backend can handle; the native path covers the rest.
export const WASM_ONLY_IMPORT = ['doc', 'odt', 'rtf'];
export const WASM_ONLY_EXPORT = ['pdf', 'odt', 'rtf', 'doc'];
