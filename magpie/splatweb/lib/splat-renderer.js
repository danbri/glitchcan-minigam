// splat-renderer.js — minimal dependency-free WebGL2 Gaussian splat
// renderer (Tier 1, DESIGN.md §5). Real 3DGS math, sketch-sized:
//   per-splat rot+scale → 3D covariance → perspective-Jacobian projection
//   → 2D covariance → eigen ellipse → instanced quad, exp(−½d²) falloff,
//   CPU back-to-front sort, premultiplied over-blending.
//
// Splat layout: 14 floats — px py pz  qx qy qz qw  sx sy sz  r g b a
export const FLOATS_PER_SPLAT = 14;

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;      // quad corner, ±1
layout(location=1) in vec3 iPos;
layout(location=2) in vec4 iQuat;
layout(location=3) in vec3 iScale;
layout(location=4) in vec4 iColor;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uFocal;                   // pixels
uniform vec2 uViewport;                 // drawing-buffer pixels
uniform float uStyleLevels;             // 0 = off, else palette quantization
out vec2 vLocal;                        // in sigma units
out vec4 vColor;

mat3 quatToMat(vec4 q){
  float x=q.x, y=q.y, z=q.z, w=q.w;
  return mat3(
    1.0-2.0*(y*y+z*z), 2.0*(x*y+w*z),     2.0*(x*z-w*y),
    2.0*(x*y-w*z),     1.0-2.0*(x*x+z*z), 2.0*(y*z+w*x),
    2.0*(x*z+w*y),     2.0*(y*z-w*x),     1.0-2.0*(x*x+y*y));
}

void main(){
  vec4 viewPos = uView * vec4(iPos, 1.0);
  if (viewPos.z > -0.05) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vLocal = vec2(9.0); vColor = vec4(0.0); return; }

  mat3 R = quatToMat(normalize(iQuat));
  mat3 S = mat3(iScale.x,0,0, 0,iScale.y,0, 0,0,iScale.z);
  mat3 M = R * S;
  mat3 cov3 = M * transpose(M);

  float tz = viewPos.z;
  vec2 lim = vec2(1.3 * uViewport.x / uFocal, 1.3 * uViewport.y / uFocal) * abs(tz);
  float tx = clamp(viewPos.x, -lim.x, lim.x);
  float ty = clamp(viewPos.y, -lim.y, lim.y);
  mat3 J = mat3(
    uFocal/tz, 0.0, 0.0,
    0.0, uFocal/tz, 0.0,
    -uFocal*tx/(tz*tz), -uFocal*ty/(tz*tz), 0.0);
  mat3 W = mat3(uView);
  mat3 T = J * W;
  mat3 cov = T * cov3 * transpose(T);

  float a = cov[0][0] + 0.15;
  float b = cov[1][0];
  float d = cov[1][1] + 0.15;
  float mid = 0.5 * (a + d);
  float disc = sqrt(max(0.0, mid*mid - (a*d - b*b)));
  float l1 = mid + disc;
  float l2 = max(mid - disc, 0.02);
  vec2 e1 = (abs(b) < 1e-6) ? ((a >= d) ? vec2(1,0) : vec2(0,1)) : normalize(vec2(b, l1 - a));
  vec2 e2 = vec2(-e1.y, e1.x);
  float r1 = min(3.0 * sqrt(l1), 512.0);
  float r2 = min(3.0 * sqrt(l2), 512.0);

  vec4 clip = uProj * viewPos;
  vec2 ndc = clip.xy / clip.w;
  vec2 offsetPx = corner.x * r1 * e1 + corner.y * r2 * e2;
  gl_Position = vec4(ndc + offsetPx / (0.5 * uViewport), 0.0, 1.0);
  vLocal = corner * 3.0;

  vec3 c = iColor.rgb;
  if (uStyleLevels > 0.5) c = floor(c * uStyleLevels + 0.5) / uStyleLevels;
  vColor = vec4(c, iColor.a);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec4 vColor;
out vec4 fragColor;
void main(){
  float d2 = dot(vLocal, vLocal);
  if (d2 > 9.0) discard;
  float alpha = exp(-0.5 * d2) * vColor.a;
  fragColor = vec4(vColor.rgb * alpha, alpha);
}`;

export class SplatRenderer {
  constructor(canvas, { background = [0.06, 0.06, 0.09] } = {}) {
    this.canvas = canvas;
    this.background = background;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.u = {};
    for (const n of ['uView', 'uProj', 'uFocal', 'uViewport', 'uStyleLevels'])
      this.u[n] = gl.getUniformLocation(prog, n);

    // static quad
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    this.instBuf = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    const stride = FLOATS_PER_SPLAT * 4;
    const attr = (loc, size, off) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    attr(1, 3, 0); attr(2, 4, 3); attr(3, 3, 7); attr(4, 4, 10);
    gl.bindVertexArray(null);

    this.count = 0;
    this.data = null;          // source-order splats
    this.sorted = null;        // reordered per frame
    this.order = null;
    this.depths = null;
    this.styleLevels = 0;
    this.camera = { pos: [0, 1.6, 4], target: [0, 1.2, 0], fovY: 55 * Math.PI / 180 };
  }

  setData(f32, count) {
    this.count = count;
    this.data = f32;
    this.sorted = new Float32Array(count * FLOATS_PER_SPLAT);
    this.order = new Uint32Array(count);
    this.depths = new Float32Array(count);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.sorted.byteLength, gl.DYNAMIC_DRAW);
  }

  // overwrite a region of the source-order data (e.g. the avatar block)
  writeRegion(startSplat, f32) {
    this.data.set(f32, startSplat * FLOATS_PER_SPLAT);
  }

  setCamera(pos, target, fovY) {
    if (pos) this.camera.pos = pos;
    if (target) this.camera.target = target;
    if (fovY) this.camera.fovY = fovY;
  }

  _resize() {
    const c = this.canvas, dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(c.clientWidth * dpr));
    const h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  render() {
    if (!this.count) return;
    this._resize();
    const gl = this.gl, c = this.canvas;
    const { pos, target, fovY } = this.camera;
    const view = lookAt(pos, target, [0, 1, 0]);
    const proj = perspective(fovY, c.width / c.height, 0.05, 100);

    sortSplats(this.data, this.count, view, this.depths, this.order, this.sorted);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sorted);

    gl.viewport(0, 0, c.width, c.height);
    const [br, bg, bb] = this.background;
    gl.clearColor(br, bg, bb, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u.uView, false, view);
    gl.uniformMatrix4fv(this.u.uProj, false, proj);
    gl.uniform1f(this.u.uFocal, c.height / (2 * Math.tan(fovY / 2)));
    gl.uniform2f(this.u.uViewport, c.width, c.height);
    gl.uniform1f(this.u.uStyleLevels, this.styleLevels);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }

  // WebXR path: draw into an XRWebGLLayer framebuffer, once per eye.
  // views: [{ viewport: {x,y,width,height}, view: mat4, proj: mat4 }];
  // model places/scales the scene in the XR reference space (uniform
  // scale in the view matrix flows through the covariance math intact).
  // Clears to transparent so immersive-ar composites camera passthrough.
  renderXR(framebuffer, views, model) {
    if (!this.count || !views.length) return;
    const gl = this.gl;
    const eyeViews = views.map(v => mul4(v.view, model));
    sortSplats(this.data, this.count, eyeViews[0], this.depths, this.order, this.sorted);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sorted);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    for (let i = 0; i < views.length; i++) {
      const vp = views[i].viewport;
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      gl.uniformMatrix4fv(this.u.uView, false, eyeViews[i]);
      gl.uniformMatrix4fv(this.u.uProj, false, views[i].proj);
      gl.uniform1f(this.u.uFocal, views[i].proj[5] * vp.height / 2);
      gl.uniform2f(this.u.uViewport, vp.width, vp.height);
      gl.uniform1f(this.u.uStyleLevels, this.styleLevels);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    }
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

// column-major mat4 multiply, a * b (for XR view ∘ scene-model composition)
export function mul4(a, b) {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) {
    r[c * 4 + i] = a[i] * b[c * 4] + a[4 + i] * b[c * 4 + 1]
      + a[8 + i] * b[c * 4 + 2] + a[12 + i] * b[c * 4 + 3];
  }
  return r;
}

// CPU back-to-front depth sort, shared by both backends (view-space z;
// camera looks down −z, farthest first)
export function sortSplats(d, n, view, depths, order, sorted) {
  const r20 = view[2], r21 = view[6], r22 = view[10], r23 = view[14];
  for (let i = 0; i < n; i++) {
    const o = i * FLOATS_PER_SPLAT;
    depths[i] = r20 * d[o] + r21 * d[o + 1] + r22 * d[o + 2] + r23;
    order[i] = i;
  }
  order.sort((a, b) => depths[a] - depths[b]);   // TypedArray sort, no allocation
  for (let i = 0; i < n; i++) {
    sorted.set(d.subarray(order[i] * FLOATS_PER_SPLAT, (order[i] + 1) * FLOATS_PER_SPLAT), i * FLOATS_PER_SPLAT);
  }
}

// column-major mat4 helpers
export function lookAt(eye, center, up) {
  const [ex, ey, ez] = eye;
  let zx = ex - center[0], zy = ey - center[1], zz = ez - center[2];
  let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  let xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1,
  ]);
}

export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}
