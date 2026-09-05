// gpu-splat-compute.js — shared WebGPU compute-pipeline scaffolding for
// animating splats ON the GPU, instead of the CPU per-splat JS loops the
// rest of this project uses (lib/lam-splats.js `pose()`,
// lib/lam-ghost-stylize.js, lib/critters.js `Critter.build()`). NONE of
// those are modified — this is a new, opt-in path next to them.
//
// The idea stays the same as the CPU version: a static rest-pose splat
// template + a handful of small per-frame parameters (bone matrices,
// squash/facing, noise/dissolve amounts) produce the posed, styled splat
// buffer that gets drawn. The only thing that changes is WHERE that
// per-splat arithmetic runs. The reusable part below is the plumbing —
// compile a compute shader, upload the static template once, re-upload
// the small per-frame parameters, dispatch, and reuse the existing
// render shader (splat-renderer-gpu.js's WGSL) to draw straight from the
// buffer the compute shader just wrote, with no CPU round-trip for the
// (large) per-splat data at all.
//
// The per-CONTENT-TYPE part — what a skinned LAM head's rest record
// looks like vs. a jelly critter's — is supplied by the caller as a WGSL
// function body, same pattern as lib/layers.js's SDF layer taking a
// `sceneGLSL` string. See lib/gpu-skinned-avatar.js and
// lib/gpu-critter.js for the two concrete uses this session, and
// demo-gpu-splats.html for both running together.
//
// SCOPE, disclosed honestly: this first GPU pipeline covers rigid/bone
// motion (avatar head turning, critter squash+hop+facing) and a handful
// of stylize params (dissolve, twinkle, roundness, ghost tint). It does
// NOT yet cover: morph-target facial expression, the "lag" secondary-
// motion trail, particle drop/enlarge, or the pentagram demo's swirl/
// fling effects — those stay CPU-only for now. Depth ordering here is
// coarse: objects are drawn back-to-front by their own (CPU-known, cheap
// — one vec3 per object, not per splat) world position; splats WITHIN
// one object are drawn in generation order, not re-sorted per frame.
// That's the right tradeoff for a first pass — see DESIGN.md-style notes
// in demo-gpu-splats.html for what a fuller version would add.
import { WGSL as RENDER_WGSL } from './splat-renderer-gpu.js';
import { FLOATS_PER_SPLAT, lookAt, perspective } from './splat-renderer.js';

export async function requestComputeDevice() {
  if (!navigator.gpu) throw new Error('WebGPU not available');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('no WebGPU adapter');
  return adapter.requestDevice();
}

// One compute pass, for ONE object (one avatar, one critter — see
// "Depth ordering" above for why objects don't share a single dispatch).
// `wgslTransform` supplies a WGSL function:
//   fn transform(i: u32) -> array<f32, 14>
// reading REST[...] (this object's static per-splat template, any
// stride the caller's WGSL agrees on — set via `restStride`) and
// OBJ[...] (a small per-frame parameter array this class re-uploads
// every dispatch — bone matrices, squash/facing, noise amounts). Both
// are plain `storage` arrays (not `uniform`) specifically to dodge
// WGSL's 16-byte-stride rule for arrays in uniform address space, which
// would otherwise force padding every single f32 into a vec4.
export class SplatComputePass {
  constructor(device, { restStride, wgslTransform, maxObjFloats = 256 }) {
    this.device = device;
    this.restStride = restStride;
    const code = `
@group(0) @binding(0) var<storage, read> REST: array<f32>;
@group(0) @binding(1) var<storage, read> OBJ: array<f32>;
@group(0) @binding(2) var<storage, read_write> OUT: array<f32>;
@group(0) @binding(3) var<uniform> COUNT: vec4<u32>; // .x = splat count, rest unused (min uniform size)

${wgslTransform}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= COUNT.x) { return; }
  let r = transform(i);
  let o = i * 14u;
  for (var k = 0u; k < 14u; k = k + 1u) { OUT[o + k] = r[k]; }
}
`;
    const module = device.createShaderModule({ code });
    this.pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    this.objBuf = device.createBuffer({ size: maxObjFloats * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.countBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.restBuf = null;
    this.outBuf = null;
    this.count = 0;
  }

  // rest: Float32Array, count*restStride floats — this object's static
  // template, uploaded once (or whenever the template itself changes,
  // e.g. a different critter appearance). outBuffer: an existing
  // GPUBuffer (STORAGE usage, >= count*14*4 bytes) to write into — this
  // is what makes it zero-copy: pass a buffer the render pipeline reads
  // directly, and the CPU never touches the animated splat data.
  setData(rest, count, outBuffer) {
    const device = this.device;
    this.count = count;
    if (this.restBuf) this.restBuf.destroy();
    this.restBuf = device.createBuffer({ size: rest.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.restBuf, 0, rest);
    this.outBuf = outBuffer;
    device.queue.writeBuffer(this.countBuf, 0, new Uint32Array([count, 0, 0, 0]));
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.restBuf } },
        { binding: 1, resource: { buffer: this.objBuf } },
        { binding: 2, resource: { buffer: this.outBuf } },
        { binding: 3, resource: { buffer: this.countBuf } },
      ],
    });
  }

  // objData: Float32Array, the small per-frame parameters (bone palette,
  // squash/facing, dissolve/twinkle/roundness/ghost...) — cheap to
  // re-upload every frame (this is dozens to a few hundred floats, not
  // per-splat).
  dispatch(objData) {
    const device = this.device;
    device.queue.writeBuffer(this.objBuf, 0, objData);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.count / 64));
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
}

// Reuses splat-renderer-gpu.js's exact render shader (imported, not
// duplicated) so GPU-compute-driven objects draw with the same, already-
// verified covariance/ellipse math as every other splat in this project.
export function createGpuRenderPipeline(device, format) {
  const module = device.createShaderModule({ code: RENDER_WGSL });
  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module, entryPoint: 'vs',
      buffers: [{ arrayStride: 8, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] }],
    },
    fragment: {
      module, entryPoint: 'fs',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        },
      }],
    },
    primitive: { topology: 'triangle-strip' },
  });
}

// One drawable object: an output storage buffer (what the compute pass
// above writes into and this reads from) plus an IDENTITY order buffer
// (0,1,2,...) — the render shader indexes splats through an order buffer
// by design (see splat-renderer-gpu.js), and an identity order is simply
// "draw them in whatever order the compute wrote them", i.e. no
// intra-object depth sort (see the module header for why that's an
// acceptable v1 tradeoff). `worldPos` is used only for the CPU-side
// back-to-front ORDERING BETWEEN objects in gpu-splat-scene.js below —
// it is not read by the shader.
export function createGpuDrawable(device, pipeline, uniformBuf, count, worldPos) {
  const outBuf = device.createBuffer({ size: count * FLOATS_PER_SPLAT * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  const orderBuf = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(orderBuf, 0, order);
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuf } },
      { binding: 1, resource: { buffer: outBuf } },
      { binding: 2, resource: { buffer: orderBuf } },
    ],
  });
  return { outBuf, orderBuf, bindGroup, count, worldPos };
}

// A tiny scene: a shared canvas/device/render pipeline/uniform buffer,
// a list of drawable objects (each produced by createGpuDrawable, each
// fed every frame by its own SplatComputePass), and a render() that
// depth-sorts objects (CHEAPLY — one vec3 each, not per splat) and
// issues one draw call per object, back-to-front.
export class GpuSplatScene {
  constructor(device, canvas, { background = [0.05, 0.05, 0.08] } = {}) {
    this.device = device;
    this.canvas = canvas;
    this.background = background;
    this.ctx = canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.configure({ device, format: this.format, alphaMode: 'opaque' });
    this.pipeline = createGpuRenderPipeline(device, this.format);
    this.quadBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.quadBuf, 0, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    this.uniformBuf = device.createBuffer({ size: 160, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.uniformData = new Float32Array(40);
    this.objects = [];
    this.camera = { pos: [0, 1.5, 4], target: [0, 1.2, 0], fovY: 50 * Math.PI / 180 };
  }

  addObject(count, worldPos) {
    const obj = createGpuDrawable(this.device, this.pipeline, this.uniformBuf, count, worldPos);
    this.objects.push(obj);
    return obj;
  }

  setCamera(pos, target, fovY) {
    if (pos) this.camera.pos = pos;
    if (target) this.camera.target = target;
    if (fovY) this.camera.fovY = fovY;
  }

  _resize() {
    const c = this.canvas;
    if (c.clientWidth === 0 && c.clientHeight === 0) return; // detached offscreen canvas — keep caller's explicit size
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  render() {
    this._resize();
    const c = this.canvas, { pos, target, fovY } = this.camera;
    const view = lookAt(pos, target, [0, 1, 0]);
    const proj = perspective(fovY, c.width / c.height, 0.05, 100);
    const u = this.uniformData;
    u.set(view, 0); u.set(proj, 16);
    u[32] = c.width; u[33] = c.height;
    u[34] = c.height / (2 * Math.tan(fovY / 2)); u[35] = 0;
    this.device.queue.writeBuffer(this.uniformBuf, 0, u);

    // cheap back-to-front object order: distance from camera, per OBJECT
    // (one subtraction+dot per object, not per splat)
    const [cx, cy, cz] = pos;
    const ordered = this.objects.slice().sort((a, b) => {
      const da = (a.worldPos[0] - cx) ** 2 + (a.worldPos[1] - cy) ** 2 + (a.worldPos[2] - cz) ** 2;
      const db = (b.worldPos[0] - cx) ** 2 + (b.worldPos[1] - cy) ** 2 + (b.worldPos[2] - cz) ** 2;
      return db - da; // farthest first
    });

    const [br, bg, bb] = this.background;
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), clearValue: { r: br, g: bg, b: bb, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    });
    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.quadBuf);
    for (const obj of ordered) {
      pass.setBindGroup(0, obj.bindGroup);
      pass.draw(4, obj.count);
    }
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
