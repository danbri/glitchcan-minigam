// gpu.js — GPU capability detection so rendering surfaces can PREFER WebGPU when
// it is genuinely available, and fall back to WebGL2/WebGL otherwise.
//
// Honesty (matches the repo's standing rule): WebGPU cannot be verified in this
// headless CI — there is no adapter under SwiftShader, and "headless visual
// verification" of WGSL silently exercises the WebGL path instead. So WebGPU is a
// PROGRESSIVE ENHANCEMENT: every caller must keep a working WebGL fallback and
// must not claim a WebGPU render is verified from headless captures. This mirrors
// Lucid's backend="auto" (Stinkyfish WebGPU → Mayfly WebGL) design.

export function hasWebGPU() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

// navigator.gpu existing does NOT guarantee a usable adapter — actually request
// one. Async + cached. Returns false on any failure (the safe default).
let _adapter; // undefined = unknown, true/false once probed
export async function webGPUAdapterAvailable() {
  if (_adapter !== undefined) return _adapter;
  if (!hasWebGPU()) return (_adapter = false);
  try { _adapter = !!(await navigator.gpu.requestAdapter()); }
  catch (_) { _adapter = false; }
  return _adapter;
}

export function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); }
  catch (_) { return false; }
}
export function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }
  catch (_) { return false; }
}

// Best backend to TRY for a new rendering surface. Synchronous (uses the cheap
// navigator.gpu presence check); for a definitive WebGPU answer await
// webGPUAdapterAvailable() and downgrade if it returns false.
export function preferredBackend() {
  if (hasWebGPU()) return 'webgpu';
  if (hasWebGL2()) return 'webgl2';
  if (hasWebGL()) return 'webgl';
  return 'cpu';
}

// A small report for diagnostics / a future "graphics" settings panel.
export async function gpuReport() {
  return {
    webgpu: hasWebGPU(),
    webgpuAdapter: await webGPUAdapterAvailable(),
    webgl2: hasWebGL2(),
    webgl: hasWebGL(),
    preferred: preferredBackend(),
  };
}
