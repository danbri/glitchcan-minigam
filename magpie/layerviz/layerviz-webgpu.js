/**
 * layerviz-webgpu.js — WebGPU implementation of the layerviz RendererAdapter
 * contract (see ../../layerviz/layerviz.js). Raw WGSL, no framework, no CDN.
 *
 * The factory is synchronous, as the contract requires. GPU setup is async
 * internally; draw calls no-op until the device is ready. The returned
 * adapter exposes a `ready` promise so the host page can detect a failed
 * device request and fall back to the WebGL adapter.
 *
 * Optimizations over the three.js adapter:
 *  - one draw call per primitive class (spheres, boxes, cylinders, planes)
 *    via instancing, plus one for all edges — 6 draws per frame total
 *  - one uniform-buffer write per frame; tiny instance updates for the
 *    animated attributes only (node bob/highlight, link pulse)
 *  - picking and label projection are CPU math on the model — no GPU
 *    readback, no per-object raycast structures
 *  - devicePixelRatio-aware surface, capped at 2, with 4x MSAA
 */

const MESH_WGSL = /* wgsl */ `
struct Uniforms {
  viewProj : mat4x4<f32>,
  camPos : vec3<f32>, pad0 : f32,
  lightDir : vec3<f32>, pad1 : f32,
  fogColor : vec3<f32>, fogNear : f32,
  // x: ambient, y: diffuse, z: fogFar, w: unused
  params : vec4<f32>,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VSIn {
  @location(0) pos : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) ipos : vec3<f32>,
  @location(3) iscale : vec3<f32>,
  @location(4) icolor : vec3<f32>,
  @location(5) iemissive : f32,
  @location(6) iopacity : f32,
};

struct VSOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) worldPos : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) color : vec3<f32>,
  @location(3) emissive : f32,
  @location(4) opacity : f32,
};

@vertex fn vs(in : VSIn) -> VSOut {
  var out : VSOut;
  let world = in.pos * in.iscale + in.ipos;
  out.clip = u.viewProj * vec4<f32>(world, 1.0);
  out.worldPos = world;
  // Normal for a non-uniformly scaled axis-aligned instance.
  out.normal = in.normal / in.iscale;
  out.color = in.icolor;
  out.emissive = in.iemissive;
  out.opacity = in.iopacity;
  return out;
}

@fragment fn fs(in : VSOut, @builtin(front_facing) front : bool) -> @location(0) vec4<f32> {
  var n = normalize(in.normal);
  if (!front) { n = -n; }
  let ndl = max(dot(n, u.lightDir), 0.0);
  var rgb = in.color * (u.params.x + u.params.y * ndl) + in.color * in.emissive;
  let dist = distance(u.camPos, in.worldPos);
  let fogT = clamp((dist - u.fogNear) / (u.params.z - u.fogNear), 0.0, 1.0);
  rgb = mix(rgb, u.fogColor, fogT);
  return vec4<f32>(rgb * in.opacity, in.opacity);
}
`;

const LINE_WGSL = /* wgsl */ `
struct Uniforms {
  viewProj : mat4x4<f32>,
  camPos : vec3<f32>, pad0 : f32,
  lightDir : vec3<f32>, pad1 : f32,
  fogColor : vec3<f32>, fogNear : f32,
  params : vec4<f32>,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VSIn {
  @location(0) pos : vec3<f32>,
  @location(1) color : vec3<f32>,
  @location(2) opacity : f32,
};

struct VSOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) worldPos : vec3<f32>,
  @location(1) color : vec3<f32>,
  @location(2) opacity : f32,
};

@vertex fn vs(in : VSIn) -> VSOut {
  var out : VSOut;
  out.clip = u.viewProj * vec4<f32>(in.pos, 1.0);
  out.worldPos = in.pos;
  out.color = in.color;
  out.opacity = in.opacity;
  return out;
}

@fragment fn fs(in : VSOut) -> @location(0) vec4<f32> {
  let dist = distance(u.camPos, in.worldPos);
  let fogT = clamp((dist - u.fogNear) / (u.params.z - u.fogNear), 0.0, 1.0);
  let rgb = mix(in.color, u.fogColor, fogT);
  return vec4<f32>(rgb * in.opacity, in.opacity);
}
`;

// ---- small matrix/vector helpers (column-major, WebGPU 0..1 clip z) ------

function perspective(fovYRad, aspect, near, far) {
  const f = 1 / Math.tan(fovYRad / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = far / (near - far);
  out[11] = -1;
  out[14] = (far * near) / (near - far);
  return out;
}

function orthographic(halfHeight, aspect, near, far) {
  const halfWidth = halfHeight * aspect;
  const out = new Float32Array(16);
  out[0] = 1 / halfWidth;
  out[5] = 1 / halfHeight;
  out[10] = 1 / (near - far);
  out[14] = near / (near - far);
  out[15] = 1;
  return out;
}

function lookAt(eye, target, up) {
  let zx = eye.x - target.x, zy = eye.y - target.y, zz = eye.z - target.z;
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = up.y * zz - up.z * zy;
  let xy = up.z * zx - up.x * zz;
  let xz = up.x * zy - up.y * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye.x + xy * eye.y + xz * eye.z),
    -(yx * eye.x + yy * eye.y + yz * eye.z),
    -(zx * eye.x + zy * eye.y + zz * eye.z),
    1
  ]);
}

function mul4(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = s;
    }
  }
  return out;
}

function transform4(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15]
  ];
}

// ---- geometry generators (unit shapes, scaled per instance) --------------

function sphereGeometry(widthSegs = 20, heightSegs = 14) {
  const verts = [], indices = [];
  for (let iy = 0; iy <= heightSegs; iy++) {
    const v = iy / heightSegs;
    const phi = v * Math.PI;
    for (let ix = 0; ix <= widthSegs; ix++) {
      const uu = ix / widthSegs;
      const theta = uu * Math.PI * 2;
      const x = -Math.cos(theta) * Math.sin(phi);
      const y = Math.cos(phi);
      const z = Math.sin(theta) * Math.sin(phi);
      verts.push(x, y, z, x, y, z);
    }
  }
  const row = widthSegs + 1;
  for (let iy = 0; iy < heightSegs; iy++) {
    for (let ix = 0; ix < widthSegs; ix++) {
      const a = iy * row + ix, b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { verts: new Float32Array(verts), indices: new Uint16Array(indices) };
}

function boxGeometry() {
  // Unit cube, half-extent 0.5, per-face normals.
  const faces = [
    [[0.5, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-0.5, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 0.5, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -0.5, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 0.5], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -0.5], [-1, 0, 0], [0, 1, 0]]
  ];
  const verts = [], indices = [];
  faces.forEach(([c, uAxis, vAxis], f) => {
    const n = [c[0] * 2, c[1] * 2, c[2] * 2];
    for (const [su, sv] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      verts.push(
        c[0] + uAxis[0] * su + vAxis[0] * sv,
        c[1] + uAxis[1] * su + vAxis[1] * sv,
        c[2] + uAxis[2] * su + vAxis[2] * sv,
        n[0], n[1], n[2]
      );
    }
    const o = f * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return { verts: new Float32Array(verts), indices: new Uint16Array(indices) };
}

function cylinderGeometry(segments = 16) {
  // Unit cylinder: radius 1, height 1 centred on origin, along +Y. Side + caps.
  const verts = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = Math.cos(t), z = Math.sin(t);
    verts.push(x, 0.5, z, x, 0, z);
    verts.push(x, -0.5, z, x, 0, z);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  for (const top of [1, -1]) {
    const centre = verts.length / 6;
    verts.push(0, 0.5 * top, 0, 0, top, 0);
    const ringStart = verts.length / 6;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      verts.push(Math.cos(t), 0.5 * top, Math.sin(t), 0, top, 0);
    }
    for (let i = 0; i < segments; i++) {
      if (top === 1) indices.push(centre, ringStart + i + 1, ringStart + i);
      else indices.push(centre, ringStart + i, ringStart + i + 1);
    }
  }
  return { verts: new Float32Array(verts), indices: new Uint16Array(indices) };
}

function planeGeometry() {
  // Unit XZ quad, half-extent 0.5, normal +Y.
  return {
    verts: new Float32Array([
      -0.5, 0, -0.5, 0, 1, 0,
      0.5, 0, -0.5, 0, 1, 0,
      0.5, 0, 0.5, 0, 1, 0,
      -0.5, 0, 0.5, 0, 1, 0
    ]),
    indices: new Uint16Array([0, 2, 1, 0, 3, 2])
  };
}

function hexToRgb(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

const INSTANCE_FLOATS = 12; // pos3 scale3 color3 emissive opacity pad

function writeInstance(arr, i, pos, scale, color, emissive, opacity) {
  const o = i * INSTANCE_FLOATS;
  arr[o] = pos.x; arr[o + 1] = pos.y; arr[o + 2] = pos.z;
  arr[o + 3] = scale[0]; arr[o + 4] = scale[1]; arr[o + 5] = scale[2];
  arr[o + 6] = color[0]; arr[o + 7] = color[1]; arr[o + 8] = color[2];
  arr[o + 9] = emissive; arr[o + 10] = opacity; arr[o + 11] = 0;
}

export function createWebGPURenderer({ container, model, config }) {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const state = {
    device: null,
    context: null,
    format: null,
    ready: false,
    disposed: false,
    width: 1,
    height: 1,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    fovY: (75 * Math.PI) / 180,
    near: 0.1,
    far: 2000,
    projection: { mode: 'perspective', halfHeight: 10 },
    fogNear: 1,
    fogFar: 100,
    view: { position: { ...config.cameraStart }, target: { ...model.focus } },
    viewProj: new Float32Array(16),
    highlightNode: null,
    bobY: new Float32Array(model.nodes.length),
    msaaTexture: null,
    depthTexture: null
  };

  const uniformData = new Float32Array(32);
  const lightLen = Math.hypot(15, 25, 15);
  const LIGHT = [15 / lightLen, 25 / lightLen, 15 / lightLen];
  const FOG_COLOR = hexToRgb(0x2a2a3a);

  // ---- static instance data built from the model -------------------------

  const sphereInstances = new Float32Array(model.nodes.length * INSTANCE_FLOATS);
  model.nodes.forEach((node, i) => {
    const layer = model.layers.find(l => l.id === node.layerId);
    const r = config.nodeRadius;
    writeInstance(sphereInstances, i, node.pos, [r, r, r],
      hexToRgb(layer.color), config.emissiveIdle, 1);
  });

  const railList = [];
  const planeList = [];
  const railLayerIds = [];
  const planeLayerIds = [];
  for (const layer of model.layers) {
    const size = config.frameSize, thick = config.frameThickness;
    const c = hexToRgb(layer.color);
    railList.push(
      [{ x: 0, y: layer.height, z: size / 2 }, [size, thick, thick], c],
      [{ x: 0, y: layer.height, z: -size / 2 }, [size, thick, thick], c],
      [{ x: size / 2, y: layer.height, z: 0 }, [thick, thick, size], c],
      [{ x: -size / 2, y: layer.height, z: 0 }, [thick, thick, size], c]
    );
    railLayerIds.push(layer.id, layer.id, layer.id, layer.id);
    planeList.push([{ x: 0, y: layer.height, z: 0 }, [size, 1, size], [1, 1, 1]]);
    planeLayerIds.push(layer.id);
  }
  const railInstances = new Float32Array(railList.length * INSTANCE_FLOATS);
  railList.forEach(([pos, scale, color], i) =>
    writeInstance(railInstances, i, pos, scale, color, 0.2, 0.8));
  const planeInstances = new Float32Array(planeList.length * INSTANCE_FLOATS);
  planeList.forEach(([pos, scale, color], i) =>
    writeInstance(planeInstances, i, pos, scale, color, 0, 0.05));

  const linkColor = hexToRgb(config.linkColor);
  const linkInstances = new Float32Array(model.links.length * INSTANCE_FLOATS);
  model.links.forEach((link, i) => {
    const h = link.maxY - link.minY;
    writeInstance(linkInstances, i,
      { x: link.x, y: link.minY + h / 2, z: link.z },
      [config.linkRadius, h, config.linkRadius],
      linkColor, config.pulseBase, 0.7);
  });

  const lineFloats = [];
  const lineLayerRanges = []; // {layerId, start, end} in vertex indices
  for (const layer of model.layers) {
    const c = hexToRgb(layer.color);
    const start = lineFloats.length / 7;
    for (const edge of layer.edges) {
      lineFloats.push(edge.a.x, edge.a.y, edge.a.z, c[0], c[1], c[2], 0.6);
      lineFloats.push(edge.b.x, edge.b.y, edge.b.z, c[0], c[1], c[2], 0.6);
    }
    lineLayerRanges.push({ layerId: layer.id, start, end: lineFloats.length / 7 });
  }
  const lineVerts = new Float32Array(lineFloats);

  // ---- async GPU setup behind a sync facade ------------------------------

  const gpu = {};

  const ready = (async () => {
    if (!navigator.gpu) throw new Error('WebGPU not available');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter');
    // Pin the adapter: if it is garbage-collected, Chromium can drop the
    // backing instance and later mapAsync calls fail.
    state.adapter = adapter;
    const device = await adapter.requestDevice();
    if (state.disposed) { device.destroy(); return; }
    state.device = device;
    state.format = navigator.gpu.getPreferredCanvasFormat();
    state.context = canvas.getContext('webgpu');
    state.context.configure({
      device,
      format: state.format,
      alphaMode: 'premultiplied',
      // COPY_SRC so debugReadPixels() can verify output headless, where
      // canvas compositing of WebGPU surfaces is unreliable.
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });

    const makeBuffer = (data, usage) => {
      const buf = device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(buf, 0, data);
      return buf;
    };
    const V = GPUBufferUsage.VERTEX;

    const geoms = {};
    for (const [name, g] of Object.entries({
      sphere: sphereGeometry(),
      box: boxGeometry(),
      cylinder: cylinderGeometry(),
      plane: planeGeometry()
    })) {
      geoms[name] = {
        vbuf: makeBuffer(g.verts, V),
        ibuf: makeBuffer(g.indices, GPUBufferUsage.INDEX),
        count: g.indices.length
      };
    }

    gpu.sphereInst = makeBuffer(sphereInstances, V);
    gpu.railInst = makeBuffer(railInstances, V);
    gpu.planeInst = makeBuffer(planeInstances, V);
    gpu.linkInst = model.links.length ? makeBuffer(linkInstances, V) : null;
    gpu.lineVbuf = lineVerts.length ? makeBuffer(lineVerts, V) : null;
    gpu.geoms = geoms;

    gpu.uniformBuf = device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const bglayout = device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }]
    });
    gpu.bindGroup = device.createBindGroup({
      layout: bglayout,
      entries: [{ binding: 0, resource: { buffer: gpu.uniformBuf } }]
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bglayout] });

    const meshModule = device.createShaderModule({ code: MESH_WGSL });
    const lineModule = device.createShaderModule({ code: LINE_WGSL });

    const blend = {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
    };
    const meshBuffers = [
      {
        arrayStride: 24,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' }
        ]
      },
      {
        arrayStride: INSTANCE_FLOATS * 4,
        stepMode: 'instance',
        attributes: [
          { shaderLocation: 2, offset: 0, format: 'float32x3' },
          { shaderLocation: 3, offset: 12, format: 'float32x3' },
          { shaderLocation: 4, offset: 24, format: 'float32x3' },
          { shaderLocation: 5, offset: 36, format: 'float32' },
          { shaderLocation: 6, offset: 40, format: 'float32' }
        ]
      }
    ];

    const makeMeshPipeline = depthWrite => device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: meshModule, entryPoint: 'vs', buffers: meshBuffers },
      fragment: {
        module: meshModule,
        entryPoint: 'fs',
        targets: [{ format: state.format, blend }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: depthWrite,
        depthCompare: 'less'
      },
      multisample: { count: 4 }
    });
    gpu.meshPipeline = makeMeshPipeline(true);
    gpu.fadePipeline = makeMeshPipeline(false);

    gpu.linePipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: lineModule,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: 28,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
            { shaderLocation: 2, offset: 24, format: 'float32' }
          ]
        }]
      },
      fragment: {
        module: lineModule,
        entryPoint: 'fs',
        targets: [{ format: state.format, blend }]
      },
      primitive: { topology: 'line-list' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false,
        depthCompare: 'less'
      },
      multisample: { count: 4 }
    });

    makeTargets();
    state.ready = true;
  })();

  function makeTargets() {
    const device = state.device;
    if (!device) return;
    const w = Math.max(1, Math.floor(state.width * state.dpr));
    const h = Math.max(1, Math.floor(state.height * state.dpr));
    canvas.width = w;
    canvas.height = h;
    state.msaaTexture?.destroy();
    state.depthTexture?.destroy();
    state.msaaTexture = device.createTexture({
      size: [w, h],
      sampleCount: 4,
      format: state.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    state.depthTexture = device.createTexture({
      size: [w, h],
      sampleCount: 4,
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  function updateViewProj() {
    const aspect = state.width / Math.max(1, state.height);
    const proj = state.projection.mode === 'orthographic'
      ? orthographic(state.projection.halfHeight, aspect, state.near, state.far)
      : perspective(state.fovY, aspect, state.near, state.far);
    const view = lookAt(state.view.position, state.view.target, { x: 0, y: 1, z: 0 });
    state.viewProj = mul4(proj, view);
    // Fog scales with camera distance so the plan-view snap's dolly-zoom
    // recession (and deep zoom-out) never fogs the scene away.
    const p = state.view.position, t = state.view.target;
    const d = Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z);
    state.fogNear = d * 0.035;
    state.fogFar = d * 3.5;
  }

  /** Camera basis + tangent of half-fov, for CPU picking. */
  function cameraRay(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const p = state.view.position, t = state.view.target;
    let fx = t.x - p.x, fy = t.y - p.y, fz = t.z - p.z;
    let len = Math.hypot(fx, fy, fz) || 1;
    fx /= len; fy /= len; fz /= len;
    let rx = -fz, ry = 0, rz = fx; // cross(forward, worldUp), worldUp=(0,1,0)
    len = Math.hypot(rx, ry, rz) || 1;
    rx /= len; rz /= len;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;
    const aspect = state.width / Math.max(1, state.height);
    if (state.projection.mode === 'orthographic') {
      // Parallel rays: offset the origin across the view plane instead.
      const hh = state.projection.halfHeight;
      const ox = ndcX * hh * aspect, oy = ndcY * hh;
      return {
        origin: {
          x: p.x + rx * ox + ux * oy,
          y: p.y + ry * ox + uy * oy,
          z: p.z + rz * ox + uz * oy
        },
        dir: { x: fx, y: fy, z: fz }
      };
    }
    const tanHalf = Math.tan(state.fovY / 2);
    const dx = fx + ndcX * tanHalf * aspect * rx + ndcY * tanHalf * ux;
    const dy = fy + ndcX * tanHalf * aspect * ry + ndcY * tanHalf * uy;
    const dz = fz + ndcX * tanHalf * aspect * rz + ndcY * tanHalf * uz;
    len = Math.hypot(dx, dy, dz) || 1;
    return { origin: p, dir: { x: dx / len, y: dy / len, z: dz / len } };
  }

  function nodeWorldY(node, i) {
    return node.pos.y + state.bobY[i];
  }

  updateViewProj();

  return {
    /** Resolves when the GPU pipeline is built; rejects if WebGPU fails. */
    ready,

    resize(width, height) {
      state.width = width;
      state.height = height;
      makeTargets();
      updateViewProj();
    },

    setView(view) {
      state.view.position = { ...view.position };
      state.view.target = { ...view.target };
      updateViewProj();
    },

    /**
     * Optional contract extension (parity with the three.js adapter):
     * { mode: 'perspective', fovDeg } or { mode: 'orthographic', halfHeight }.
     */
    setProjection(p) {
      if (p.mode === 'orthographic') {
        state.projection = {
          mode: 'orthographic',
          halfHeight: p.halfHeight ?? state.projection.halfHeight
        };
      } else {
        state.projection = { mode: 'perspective', halfHeight: state.projection.halfHeight };
        if (p.fovDeg) state.fovY = (p.fovDeg * Math.PI) / 180;
      }
      updateViewProj();
    },

    animate(timeMs, animating) {
      if (!animating) return;
      model.nodes.forEach((node, i) => {
        state.bobY[i] =
          Math.sin(timeMs * config.bobSpeed + i * 0.5) * config.bobAmplitude;
        sphereInstances[i * INSTANCE_FLOATS + 1] = node.pos.y + state.bobY[i];
      });
      model.links.forEach((link, i) => {
        linkInstances[i * INSTANCE_FLOATS + 9] =
          config.pulseBase + Math.sin(timeMs * config.pulseSpeed + i) * config.pulseAmplitude;
      });
    },

    render() {
      if (!state.ready || state.disposed) return;
      const device = state.device;

      uniformData.set(state.viewProj, 0);
      const p = state.view.position;
      uniformData[16] = p.x; uniformData[17] = p.y; uniformData[18] = p.z;
      uniformData[20] = LIGHT[0]; uniformData[21] = LIGHT[1]; uniformData[22] = LIGHT[2];
      uniformData[24] = FOG_COLOR[0]; uniformData[25] = FOG_COLOR[1]; uniformData[26] = FOG_COLOR[2];
      uniformData[27] = state.fogNear;
      uniformData[28] = 0.4;  // ambient
      uniformData[29] = 0.6;  // diffuse
      uniformData[30] = state.fogFar;
      device.queue.writeBuffer(gpu.uniformBuf, 0, uniformData);
      device.queue.writeBuffer(gpu.sphereInst, 0, sphereInstances);
      if (gpu.linkInst) device.queue.writeBuffer(gpu.linkInst, 0, linkInstances);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: state.msaaTexture.createView(),
          resolveTarget: state.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'discard'
        }],
        depthStencilAttachment: {
          view: state.depthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: 'clear',
          depthStoreOp: 'discard'
        }
      });
      pass.setBindGroup(0, gpu.bindGroup);

      const drawInstanced = (geom, instBuf, count) => {
        pass.setVertexBuffer(0, geom.vbuf);
        pass.setVertexBuffer(1, instBuf);
        pass.setIndexBuffer(geom.ibuf, 'uint16');
        pass.drawIndexed(geom.count, count);
      };

      pass.setPipeline(gpu.meshPipeline);
      drawInstanced(gpu.geoms.box, gpu.railInst, railList.length);
      if (gpu.linkInst) drawInstanced(gpu.geoms.cylinder, gpu.linkInst, model.links.length);
      drawInstanced(gpu.geoms.sphere, gpu.sphereInst, model.nodes.length);

      if (gpu.lineVbuf) {
        pass.setPipeline(gpu.linePipeline);
        pass.setVertexBuffer(0, gpu.lineVbuf);
        pass.draw(lineVerts.length / 7);
      }

      pass.setPipeline(gpu.fadePipeline);
      drawInstanced(gpu.geoms.plane, gpu.planeInst, planeList.length);

      pass.end();
      device.queue.submit([encoder.finish()]);
    },

    projectNode(node) {
      const i = model.nodes.indexOf(node);
      if (i < 0) return null;
      const wx = node.pos.x;
      const wy = nodeWorldY(node, i) + config.labelYOffset;
      const wz = node.pos.z;
      const [cx, cy, cz, cw] = transform4(state.viewProj, wx, wy, wz);
      if (cw <= 0) return { x: 0, y: 0, distance: Infinity, inFront: false };
      const p = state.view.position;
      return {
        x: (cx / cw * 0.5 + 0.5) * state.width,
        y: (-cy / cw * 0.5 + 0.5) * state.height,
        distance: Math.hypot(wx - p.x, wy - p.y, wz - p.z),
        inFront: cz / cw < 1
      };
    },

    pick(clientX, clientY) {
      const { origin, dir } = cameraRay(clientX, clientY);
      const r = config.nodeRadius * config.hoverScale;
      let best = null;
      let bestT = Infinity;
      model.nodes.forEach((node, i) => {
        const ox = origin.x - node.pos.x;
        const oy = origin.y - nodeWorldY(node, i);
        const oz = origin.z - node.pos.z;
        const b = ox * dir.x + oy * dir.y + oz * dir.z;
        const c = ox * ox + oy * oy + oz * oz - r * r;
        const disc = b * b - c;
        if (disc < 0) return;
        const t = -b - Math.sqrt(disc);
        if (t > 0 && t < bestT) {
          bestT = t;
          best = node;
        }
      });
      return best;
    },

    /**
     * Optional contract extension (parity with the three.js adapter):
     * spotlight one layer by dimming every other layer's instances.
     * Cheap here — instance/vertex opacity floats are rewritten in place.
     */
    setLayerFocus(layerId) {
      const DIM = 0.12;
      const layerById = new Map(model.layers.map(l => [l.id, l]));
      const height = layerById.get(layerId)?.height;
      const factor = lit => (layerId == null || lit) ? 1 : DIM;

      model.nodes.forEach((node, i) => {
        sphereInstances[i * INSTANCE_FLOATS + 10] =
          1 * factor(node.layerId === layerId);
      });
      railLayerIds.forEach((id, i) => {
        railInstances[i * INSTANCE_FLOATS + 10] = 0.8 * factor(id === layerId);
      });
      planeLayerIds.forEach((id, i) => {
        planeInstances[i * INSTANCE_FLOATS + 10] = 0.05 * factor(id === layerId);
      });
      model.links.forEach((link, i) => {
        linkInstances[i * INSTANCE_FLOATS + 10] = 0.7 *
          factor(height !== undefined && link.minY <= height && height <= link.maxY);
      });
      for (const r of lineLayerRanges) {
        const lit = factor(r.layerId === layerId);
        for (let v = r.start; v < r.end; v++) lineVerts[v * 7 + 6] = 0.6 * lit;
      }
      // Sphere + link buffers rewrite every frame; the static ones need a
      // push now (if the device is up — otherwise init uploads the arrays).
      if (state.ready && !state.disposed) {
        state.device.queue.writeBuffer(gpu.railInst, 0, railInstances);
        state.device.queue.writeBuffer(gpu.planeInst, 0, planeInstances);
        if (gpu.lineVbuf) state.device.queue.writeBuffer(gpu.lineVbuf, 0, lineVerts);
      }
    },

    setHighlight(node) {
      const prev = state.highlightNode;
      state.highlightNode = node;
      for (const target of [prev, node]) {
        if (!target) continue;
        const i = model.nodes.indexOf(target);
        if (i < 0) continue;
        const on = target === node;
        const s = config.nodeRadius * (on ? config.hoverScale : 1);
        const o = i * INSTANCE_FLOATS;
        sphereInstances[o + 3] = s;
        sphereInstances[o + 4] = s;
        sphereInstances[o + 5] = s;
        sphereInstances[o + 9] = on ? config.emissiveHover : config.emissiveIdle;
      }
    },

    /**
     * Test hook (not part of the RendererAdapter contract): render one
     * frame, then read a centre block of the canvas texture back to the
     * CPU. Lets headless tests confirm pixels were actually drawn even
     * when the compositor never shows the WebGPU surface.
     */
    async debugReadPixels() {
      if (!state.ready || state.disposed) return null;
      this.render();
      const w = 64, h = 64;
      const bytesPerRow = w * 4; // 256, satisfies the 256-byte alignment rule
      const buf = state.device.createBuffer({
        size: bytesPerRow * h,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const encoder = state.device.createCommandEncoder();
      encoder.copyTextureToBuffer(
        {
          texture: state.context.getCurrentTexture(),
          origin: [
            Math.max(0, (canvas.width - w) >> 1),
            Math.max(0, (canvas.height - h) >> 1),
            0
          ]
        },
        { buffer: buf, bytesPerRow },
        [Math.min(w, canvas.width), Math.min(h, canvas.height), 1]
      );
      state.device.queue.submit([encoder.finish()]);
      await buf.mapAsync(GPUMapMode.READ);
      const data = new Uint8Array(buf.getMappedRange());
      let nonzero = 0;
      const sampleColors = new Set();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] || data[i + 1] || data[i + 2] || data[i + 3]) {
          nonzero++;
          if (sampleColors.size < 8) {
            sampleColors.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
          }
        }
      }
      buf.unmap();
      buf.destroy();
      return { sampled: w * h, nonzero, sampleColors: [...sampleColors] };
    },

    dispose() {
      state.disposed = true;
      state.ready = false;
      state.msaaTexture?.destroy();
      state.depthTexture?.destroy();
      state.device?.destroy();
      canvas.remove();
    }
  };
}
