// splat-renderer-gpu.js — WebGPU/WGSL Gaussian splat rasterizer with the
// same interface and 14-float splat layout as the WebGL2 renderer
// (splat-renderer.js). Same math: covariance → perspective Jacobian →
// eigen ellipse → instanced quad, exp(−½d²), premultiplied over.
//
// Efficiency over the WebGL path: splat data lives in a GPU storage
// buffer uploaded ONCE (writeRegion patches just its dirty range); the
// vertex stage pulls splats through a per-frame sorted index buffer, so
// each frame uploads count×4 bytes instead of count×56. The depth sort
// itself is still CPU (shared with WebGL); a WGSL compute sort is the
// remaining step.
import { FLOATS_PER_SPLAT, lookAt, perspective, sortIndicesApprox, makeSortScratch } from './splat-renderer.js';

// Exported (purely additive — every existing importer keeps working
// unchanged) so lib/gpu-splat-compute.js can reuse this exact, already-
// working render shader for GPU-compute-driven objects instead of
// duplicating it and risking drift between two copies.
export const WGSL = /* wgsl */`
struct Uniforms {
  view: mat4x4f,
  proj: mat4x4f,
  vfs: vec4f,        // viewport.xy, focal px, styleLevels
};
@group(0) @binding(0) var<uniform> U: Uniforms;

@group(0) @binding(1) var<storage, read> S: array<f32>;   // 14 floats per splat
@group(0) @binding(2) var<storage, read> ORD: array<u32>; // back-to-front order

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) local: vec2f,
  @location(1) color: vec4f,
};

fn quatToMat(q: vec4f) -> mat3x3f {
  let x = q.x; let y = q.y; let z = q.z; let w = q.w;
  return mat3x3f(
    vec3f(1.0 - 2.0*(y*y + z*z), 2.0*(x*y + w*z), 2.0*(x*z - w*y)),
    vec3f(2.0*(x*y - w*z), 1.0 - 2.0*(x*x + z*z), 2.0*(y*z + w*x)),
    vec3f(2.0*(x*z + w*y), 2.0*(y*z - w*x), 1.0 - 2.0*(x*x + y*y)));
}

@vertex
fn vs(@location(0) corner: vec2f, @builtin(instance_index) inst: u32) -> VSOut {
  let bi = ORD[inst] * 14u;
  let iPos = vec3f(S[bi], S[bi + 1u], S[bi + 2u]);
  let iQuat = vec4f(S[bi + 3u], S[bi + 4u], S[bi + 5u], S[bi + 6u]);
  let iScale = vec3f(S[bi + 7u], S[bi + 8u], S[bi + 9u]);
  let iColor = vec4f(S[bi + 10u], S[bi + 11u], S[bi + 12u], S[bi + 13u]);
  var out: VSOut;
  let viewPos = U.view * vec4f(iPos, 1.0);
  if (viewPos.z > -0.05) {
    out.pos = vec4f(0.0, 0.0, 2.0, 1.0); out.local = vec2f(9.0); out.color = vec4f(0.0);
    return out;
  }
  let R = quatToMat(normalize(iQuat));
  let Sm = mat3x3f(vec3f(iScale.x, 0.0, 0.0), vec3f(0.0, iScale.y, 0.0), vec3f(0.0, 0.0, iScale.z));
  let M = R * Sm;
  let cov3 = M * transpose(M);

  let viewport = U.vfs.xy;
  let focal = U.vfs.z;
  let tz = viewPos.z;
  let lim = 1.3 * viewport / focal * abs(tz);
  let tx = clamp(viewPos.x, -lim.x, lim.x);
  let ty = clamp(viewPos.y, -lim.y, lim.y);
  let J = mat3x3f(
    vec3f(focal / tz, 0.0, 0.0),
    vec3f(0.0, focal / tz, 0.0),
    vec3f(-focal * tx / (tz * tz), -focal * ty / (tz * tz), 0.0));
  let W = mat3x3f(U.view[0].xyz, U.view[1].xyz, U.view[2].xyz);
  let T = J * W;
  let cov = T * cov3 * transpose(T);

  let a = cov[0][0] + 0.15;
  let b = cov[1][0];
  let d = cov[1][1] + 0.15;
  let mid = 0.5 * (a + d);
  let disc = sqrt(max(0.0, mid * mid - (a * d - b * b)));
  let l1 = mid + disc;
  let l2 = max(mid - disc, 0.02);
  var e1: vec2f;
  if (abs(b) < 1e-6) {
    e1 = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), a >= d);
  } else {
    e1 = normalize(vec2f(b, l1 - a));
  }
  let e2 = vec2f(-e1.y, e1.x);
  let r1 = min(3.0 * sqrt(l1), 512.0);
  let r2 = min(3.0 * sqrt(l2), 512.0);

  let clip = U.proj * viewPos;
  let ndc = clip.xy / clip.w;
  let offsetPx = corner.x * r1 * e1 + corner.y * r2 * e2;
  out.pos = vec4f(ndc + offsetPx / (0.5 * viewport), 0.0, 1.0);
  out.local = corner * 3.0;
  var c = iColor.rgb;
  let lv = U.vfs.w;
  if (lv > 0.5) { c = floor(c * lv + vec3f(0.5)) / lv; }
  out.color = vec4f(c, iColor.a);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let d2 = dot(in.local, in.local);
  if (d2 > 9.0) { discard; }
  let alpha = exp(-0.5 * d2) * in.color.a;
  return vec4f(in.color.rgb * alpha, alpha);
}
`;

export class WebGPUSplatRenderer {
  // alpha: true — see the same option on SplatRenderer (splat-renderer.js):
  // clears transparent instead of opaque, so this can sit in a compositor
  // graph as one layer among others.
  static async create(canvas, { background = [0.06, 0.06, 0.09], alpha = false } = {}) {
    if (!navigator.gpu) throw new Error('WebGPU not available');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('no WebGPU adapter');
    const device = await adapter.requestDevice();
    const r = new WebGPUSplatRenderer();
    r.canvas = canvas;
    r.device = device;
    r.background = background;
    r.alpha = alpha;
    r.ctx = canvas.getContext('webgpu');
    if (!r.ctx) throw new Error('no webgpu canvas context');
    r.format = navigator.gpu.getPreferredCanvasFormat();
    r.ctx.configure({ device, format: r.format, alphaMode: alpha ? 'premultiplied' : 'opaque' });

    const module = device.createShaderModule({ code: WGSL });
    r.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module, entryPoint: 'vs',
        buffers: [
          { arrayStride: 8, stepMode: 'vertex',
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] },
        ],
      },
      fragment: {
        module, entryPoint: 'fs',
        targets: [{
          format: r.format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-strip' },
    });

    r.quadBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(r.quadBuf, 0, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    r.uniformBuf = device.createBuffer({ size: 160, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    r.uniformData = new Float32Array(40);
    r.bindGroup = null;   // built in setData once the storage buffers exist

    r.count = 0;
    r.data = null;
    r.sorted = null;
    r.order = null;
    r.depths = null;
    r.instBuf = null;
    r.styleLevels = 0;
    r.camera = { pos: [0, 1.6, 4], target: [0, 1.2, 0], fovY: 55 * Math.PI / 180 };
    return r;
  }

  setData(f32, count) {
    this.count = count;
    this.data = f32;
    this.order = new Uint32Array(count);
    this.depths = new Float32Array(count);
    this.sortScratch = makeSortScratch(count);
    if (this.splatBuf) this.splatBuf.destroy();
    if (this.orderBuf) this.orderBuf.destroy();
    // splat data uploaded ONCE; per-frame traffic is just the order buffer
    this.splatBuf = this.device.createBuffer({
      size: Math.max(f32.byteLength, 16),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.splatBuf, 0, f32, 0, count * FLOATS_PER_SPLAT);
    this.orderBuf = this.device.createBuffer({
      size: Math.max(count * 4, 16),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.splatBuf } },
        { binding: 2, resource: { buffer: this.orderBuf } },
      ],
    });
  }

  writeRegion(startSplat, f32) {
    this.data.set(f32, startSplat * FLOATS_PER_SPLAT);
    // patch only the dirty range of the resident storage buffer
    this.device.queue.writeBuffer(this.splatBuf, startSplat * FLOATS_PER_SPLAT * 4, f32);
  }

  setCamera(pos, target, fovY) {
    if (pos) this.camera.pos = pos;
    if (target) this.camera.target = target;
    if (fovY) this.camera.fovY = fovY;
  }

  // See the same method in splat-renderer.js for why this checks for a
  // detached (no CSS layout) canvas first.
  _resize() {
    const c = this.canvas;
    if (c.clientWidth === 0 && c.clientHeight === 0) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(c.clientWidth * dpr));
    const h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  render() {
    if (!this.count) return;
    this._resize();
    const c = this.canvas;
    const { pos, target, fovY } = this.camera;
    const view = lookAt(pos, target, [0, 1, 0]);
    const proj = perspective(fovY, c.width / c.height, 0.05, 100);

    // CPU depth sort of INDICES only (no data reorder, no data upload) —
    // an O(n) bucket sort (see sortIndicesApprox in splat-renderer.js) in
    // place of a comparator sort. Measured on this project's own 5-avatar
    // demo: the comparator sort was a bigger per-frame cost than the
    // entire GPU upload + draw combined.
    const n = this.count;
    sortIndicesApprox(this.data, n, view, this.depths, this.order, this.sortScratch);
    this.device.queue.writeBuffer(this.orderBuf, 0, this.order, 0, n);

    const u = this.uniformData;
    u.set(view, 0);
    u.set(proj, 16);
    u[32] = c.width; u[33] = c.height;
    u[34] = c.height / (2 * Math.tan(fovY / 2));
    u[35] = this.styleLevels;
    this.device.queue.writeBuffer(this.uniformBuf, 0, u);

    const [br, bg, bb] = this.background;
    const clearValue = this.alpha ? { r: 0, g: 0, b: 0, a: 0 } : { r: br, g: bg, b: bb, a: 1 };
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.ctx.getCurrentTexture().createView(),
        clearValue, loadOp: 'clear', storeOp: 'store',
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.quadBuf);
    pass.draw(4, this.count);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
