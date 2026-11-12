// /agi-bin/: small WebAssembly programs that build files in a pod when other files change
// (Markdown to HTML, a feed from a folder of posts). The shell runs them; nothing else does.
//
// A handler is two files in the pod's `agi-bin/` folder: `<name>.wasm` and `<name>.json`, its
// manifest. It runs only after the owner approves it, and the approval names the exact bytes (the
// SHA-256 of the .wasm): a changed program does not run until it is approved again.
//
// What a handler can do, and what keeps it to that (each is checked here, and stated as a theorem
// in factoidal-core LWS/PodAgi.lean):
//   - it sees only its input: the bytes of the file (or files) that triggered it, and their names;
//   - it imports nothing but the memory the shell gives it (`env.memory`), whose size is capped, so
//     it has no network, no clock, no randomness, no pod: the same input gives the same output;
//   - it runs in a Worker that is stopped after `timeMs`, and its output is at most `outputBytes`;
//   - it writes one file, at a path computed from the input path by its manifest, and that path
//     must be under its declared output folder, outside `agi-bin/`, and not one of its own inputs;
//   - a file written by a handler never triggers a handler, so handlers cannot set each other off.

export const AGI_LIMITS = Object.freeze({
  wasmBytes: 1024 * 1024,        // a handler's program
  memoryPages: 256,              // 16 MiB of memory at most
  timeMs: 2000,                  // stopped after this
  inputBytes: 8 * 1024 * 1024,   // what it is given
  inputFiles: 200,               // for a folder handler
  outputBytes: 8 * 1024 * 1024,  // what it may give back
});

export const AGI_DIR = 'agi-bin/';
const NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** A glob over pod paths: `*` within one folder, `**` across folders, `?` one character. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += glob[i + 2] === '/' ? 2 : 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'u');
}

const cleanRel = (p) => {
  const parts = String(p).split('/');
  if (!p || p.startsWith('/') || parts.some((s) => s === '' || s === '.' || s === '..')) return null;
  return parts.join('/');
};

/**
 * Check a manifest. { name, match, output, kind } where `kind` is 'file' (one input, one output:
 * `output` is a template with {dir}, {name} (without extension) and {path}) or 'folder' (every
 * file matching `match` is the input; `output` is a fixed path). `outputDir` is the folder every
 * output must be under. Returns the manifest, or throws with the reason.
 */
export function checkManifest(name, m) {
  if (!NAME.test(name)) throw new Error('agi: a handler name is lower case letters, digits and -');
  if (!m || typeof m !== 'object') throw new Error('agi: the manifest is not an object');
  const kind = m.kind === 'folder' ? 'folder' : 'file';
  const match = String(m.match || '');
  const outputDir = String(m.outputDir || '');
  const output = String(m.output || '');
  if (!match || match.startsWith(AGI_DIR) || match.startsWith('/')) throw new Error('agi: match: a pattern over the pod, not in agi-bin/');
  if (!outputDir.endsWith('/') || cleanRel(outputDir.slice(0, -1)) === null || outputDir.startsWith(AGI_DIR)) throw new Error('agi: outputDir: a folder in the pod, ending in /, not agi-bin/');
  if (!output) throw new Error('agi: output is needed');
  return { name, kind, match, matchRe: globToRegExp(match), output, outputDir, description: String(m.description || '').slice(0, 300) };
}

/**
 * Where a handler writes for this input, or null when it may not: the path must be clean, under
 * the handler's outputDir, outside agi-bin/, and not a path the handler itself reads.
 */
export function outputPathFor(h, inputPath) {
  let out = h.output;
  if (h.kind === 'file') {
    const slash = inputPath.lastIndexOf('/');
    const dir = inputPath.slice(0, slash + 1);
    const file = inputPath.slice(slash + 1);
    const dot = file.lastIndexOf('.');
    const stem = dot > 0 ? file.slice(0, dot) : file;
    out = out.replaceAll('{dir}', dir).replaceAll('{name}', stem).replaceAll('{path}', inputPath);
  }
  const clean = cleanRel(out);
  if (clean === null || !clean.startsWith(h.outputDir) || clean.startsWith(AGI_DIR) || h.matchRe.test(clean)) return null;
  return clean;
}

/** Which handlers a write to `path` sets off. A write made by a handler sets off none. */
export function triggered(handlers, path, { byHandler = false } = {}) {
  if (byHandler || path.startsWith(AGI_DIR)) return [];
  return handlers.filter((h) => h.matchRe.test(path));
}

/**
 * Is this a module a handler may be? Imports exactly `env.memory` and nothing else; exports
 * `alloc` and `run`. Returns null, or the reason it is refused.
 */
export function checkModule(bytes) {
  if (bytes.byteLength > AGI_LIMITS.wasmBytes) return 'too-large';
  let mod;
  try { mod = new WebAssembly.Module(bytes); } catch { return 'not-wasm'; }
  const imports = WebAssembly.Module.imports(mod);
  if (imports.length !== 1 || imports[0].module !== 'env' || imports[0].name !== 'memory' || imports[0].kind !== 'memory') return 'imports';
  const ex = new Set(WebAssembly.Module.exports(mod).map((e) => e.name));
  if (!ex.has('alloc') || !ex.has('run')) return 'exports';
  return null;
}

/** SHA-256 of the bytes, as hex: what an approval names. */
export async function sha256(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * The input a handler is given. A file handler gets `path\0bytes`; a folder handler gets, for each
 * file, u32 name length, name, u32 data length, data (little-endian), after a u32 count.
 */
export function frameInput(h, files) {
  const enc = new TextEncoder();
  if (h.kind === 'file') {
    const [f] = files;
    const name = enc.encode(f.path);
    const out = new Uint8Array(name.length + 1 + f.bytes.length);
    out.set(name); out.set(f.bytes, name.length + 1);
    return out;
  }
  const parts = [];
  const u32 = (n) => new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);
  parts.push(u32(files.length));
  for (const f of files) { const n = enc.encode(f.path); parts.push(u32(n.length), n, u32(f.bytes.length), f.bytes); }
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/**
 * The worker's code: instantiate with the capped memory, copy the input in, call run, read
 * back [u32 length][bytes]. Any trap, a missing export or an output past the limit is a refusal.
 */
export const WORKER_SOURCE = `
onmessage = async (e) => {
  const { wasm, input, maxPages, maxOut } = e.data;
  try {
    const memory = new WebAssembly.Memory({ initial: Math.min(32, maxPages), maximum: maxPages });
    const { instance } = await WebAssembly.instantiate(wasm, { env: { memory } });
    const { alloc, run } = instance.exports;
    const at = alloc(input.length) >>> 0;
    new Uint8Array(memory.buffer).set(input, at);
    const out = run(at, input.length) >>> 0;
    const view = new DataView(memory.buffer);
    if (out + 4 > memory.buffer.byteLength) throw new Error('bad-output');
    const len = view.getUint32(out, true);
    if (len > maxOut || out + 4 + len > memory.buffer.byteLength) throw new Error('too-large');
    postMessage({ ok: true, bytes: new Uint8Array(memory.buffer, out + 4, len).slice() });
  } catch (err) {
    postMessage({ ok: false, reason: /too-large|bad-output/.test(String(err?.message)) ? String(err.message) : 'trap' });
  }
};`;

/**
 * Run a handler's module on its input, in a fresh Worker that is stopped after `timeMs`.
 * `makeWorker(source)` gives a Worker-like object (browser: a Blob-URL Worker; tests: Node's).
 * Resolves { ok: true, bytes } or { ok: false, reason } — 'timeout', 'trap', 'too-large', ...
 */
export function runHandler(makeWorker, wasm, input, limits = AGI_LIMITS) {
  if (input.length > limits.inputBytes) return Promise.resolve({ ok: false, reason: 'too-large' });
  return new Promise((resolve) => {
    const w = makeWorker(WORKER_SOURCE);
    let done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { w.terminate(); } catch { /* gone */ } resolve(r); };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), limits.timeMs);
    w.onmessage = (e) => finish(e.data ?? e);
    w.onerror = () => finish({ ok: false, reason: 'trap' });
    w.postMessage({ wasm, input, maxPages: limits.memoryPages, maxOut: limits.outputBytes });
  });
}
