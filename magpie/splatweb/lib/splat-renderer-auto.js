// splat-renderer-auto.js — backend selection: WebGPU when available,
// WebGL2 otherwise. Force with ?backend=webgl or ?backend=webgpu (the
// forced-webgpu path throws instead of silently falling back, so a claim
// of "verified on WebGPU" can't secretly test WebGL — the same honesty
// rule as CLAUDE.md's headless note).
import { SplatRenderer } from './splat-renderer.js';
import { WebGPUSplatRenderer } from './splat-renderer-gpu.js';

export async function createSplatRenderer(canvas, opts = {}) {
  const want = new URLSearchParams(location.search).get('backend');
  if (want !== 'webgl' && typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const r = await WebGPUSplatRenderer.create(canvas, opts);
      r.backend = 'webgpu';
      return r;
    } catch (e) {
      if (want === 'webgpu') throw e;
      console.warn('WebGPU unavailable, falling back to WebGL2:', e.message || e);
    }
  }
  if (want === 'webgpu') throw new Error('WebGPU not available in this browser');
  const r = new SplatRenderer(canvas, opts);
  r.backend = 'webgl2';
  return r;
}
