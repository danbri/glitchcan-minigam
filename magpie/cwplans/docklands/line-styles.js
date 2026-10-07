// Line styles of the 3D page (Layers > Style): "Line drawing" (?lines), the plotter look in real time. The edges come from plotter-svg.js (DocklandsPlot.scene: the same
// rules as the plotter SVG); the page's own solids go into the depth buffer only, then the edges are drawn as screen-space
// quads of a fixed CSS-pixel width with the depth test on. index.html gives DocklandsLinesCtx and calls ready() and frame() from render().
// Skill: docklands-3d-page, "Line styles".
(() => {
let C = null, gl = null;
const $ = id => document.getElementById(id);
const S = { mode: null, buf: null, n: 0, key: '', want: '', pending: 0, stats: null };
const LI = { bld: 0, water: 1, green: 2, road: 3, rail: 4, path: 5, under: 6 }, MERGE = new Set(['water', 'green', 'road', 'rail']);
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
// Line drawing: the plotter's pen colours (plotter-svg.js LAYERS)
const PEN = () => DocklandsPlot.LAYERS.map(l => [...hex(l[2]), 1]);
const W_LINE = 1.1, LO = 4;   // CSS px: line width; a building under LO px is not drawn, under 3 LO px only its roof outline (the plotter: 1 mm and 3 mm, 4 and 12 CSS px on A3 from a 1600 px screen)

// ---------- the edges, once per state (cut open or not, underground switches, tunnel shape, towers loaded)
function keyOf(P) {
  const ST = globalThis.DocklandsStations, ck = id => $(id) && $(id).checked ? 1 : 0;
  return [P.cut < 250 ? 1 : 0, P.storey, P.dmax, P.grad, P.ddeep, ck('showUnder'), ck('showStations'), DocklandsPlotCtx.TOWERS() ? 1 : 0, ST ? ST.hideKey() : '', ST && ST.S && ST.S.doc ? 1 : 0].join('|');
}
function build(P) {
  const t0 = performance.now(), cutOn = P.cut < 250;
  // 28 bytes an edge: both ends as floats (not 16-bit: skill), then layer, rank and size (quarter metres)
  let cap = 1 << 18, n = 0, buf = new ArrayBuffer(cap * 28), f32 = new Float32Array(buf), u8 = new Uint8Array(buf);
  const counts = {}, push = (li, a, b, g) => {
    if (n === cap) { cap *= 2; const b2 = new ArrayBuffer(cap * 28); new Uint8Array(b2).set(u8); buf = b2; f32 = new Float32Array(buf); u8 = new Uint8Array(buf); }
    f32.set(a, 7 * n); f32.set(b, 7 * n + 3); const s = g ? Math.min(65535, Math.round(g[0] * 4)) : 0, m = 28 * n + 24;
    u8[m] = li; u8[m + 1] = g ? g[1] : 3; u8[m + 2] = s & 255; u8[m + 3] = s >> 8; n++; counts[li] = (counts[li] || 0) + 1;
  };
  // ground lines arrive in 10 m pieces (draped on the terrain triangles); a run of pieces becomes one edge while every
  // point of it stays within 5 cm of the joined edge (at most 40 pieces)
  let run = null; const flush = () => { if (run) { push(run.li, run.p[0], run.p[run.p.length - 1], run.g); run = null; } };
  const off = (p, a, b) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / L2)) : 0;
    return Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t, p[2] - a[2] - d[2] * t); };
  const emit = (L, a, b, g) => { const li = LI[L];
    if (!MERGE.has(L)) { flush(); push(li, a, b, g); return; }
    if (run && run.li === li && run.g === g) { const e = run.p[run.p.length - 1];
      if (e[0] === a[0] && e[1] === a[1] && e[2] === a[2]) {
        if (run.p.length < 41 && run.p.every((p, i) => i === 0 || off(p, run.p[0], b) < .05)) { run.p.push(b); return; }
        flush(); run = { li, g, p: [a, b] }; return; } }
    flush(); run = { li, g, p: [a, b] }; };
  DocklandsPlot.scene({ ...P, cut: 999 }, { emit, under: cutOn }); flush();
  // tiles of TILE m by the edge's middle; in each tile the edges in order of size, largest first (rank 1 counts a third of
  // its size, rank 3 first of all), so a frame draws a visible tile's edges only down to the size that the distance hides
  const TILE = 400, i32 = new Uint32Array(buf), key = new Float32Array(n), tile = new Uint32Array(n);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let e = 0; e < n; e++) { const mx = (f32[7 * e] + f32[7 * e + 3]) / 2, mz = (f32[7 * e + 2] + f32[7 * e + 5]) / 2; x0 = Math.min(x0, mx); x1 = Math.max(x1, mx); z0 = Math.min(z0, mz); z1 = Math.max(z1, mz); }
  const nx = Math.floor((x1 - x0) / TILE) + 1, nz = Math.floor((z1 - z0) / TILE) + 1, cnt = new Uint32Array(nx * nz + 1);
  for (let e = 0; e < n; e++) { const mx = (f32[7 * e] + f32[7 * e + 3]) / 2, mz = (f32[7 * e + 2] + f32[7 * e + 5]) / 2, m = 28 * e + 24, r = u8[m + 1], sz = (u8[m + 2] + 256 * u8[m + 3]) / 4;
    tile[e] = Math.floor((mx - x0) / TILE) + nx * Math.floor((mz - z0) / TILE); key[e] = r === 3 ? 1e9 : r === 1 ? sz / 3 : sz; cnt[tile[e] + 1]++; }
  for (let t = 0; t < nx * nz; t++) cnt[t + 1] += cnt[t];
  const order = new Uint32Array(n), fill = cnt.slice(0, nx * nz); for (let e = 0; e < n; e++) order[fill[tile[e]]++] = e;
  const out = new ArrayBuffer(n * 28), o32 = new Uint32Array(out), of = new Float32Array(out), keys = new Float32Array(n), tiles = [];
  for (let t = 0; t < nx * nz; t++) { const a = cnt[t], b = cnt[t + 1]; if (a === b) continue; const sub = order.subarray(a, b); sub.sort((i, j) => key[j] - key[i]);
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let k = a; k < b; k++) { const e = sub[k - a]; o32.set(i32.subarray(7 * e, 7 * e + 7), 7 * k); keys[k] = key[e];
      for (let c = 0; c < 6; c++) { const v = of[7 * k + c]; box[c % 3] = Math.min(box[c % 3], v); box[3 + c % 3] = Math.max(box[3 + c % 3], v); } }
    tiles.push({ s: a, n: b - a, box, keys: keys.subarray(a, b) }); }
  if (S.buf) gl.deleteBuffer(S.buf);
  S.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, S.buf); gl.bufferData(gl.ARRAY_BUFFER, out, gl.STATIC_DRAW);
  S.n = n; S.tiles = tiles; S.stats = { edges: n, byLayer: Object.fromEntries(Object.entries(LI).map(([k, v]) => [k, counts[v] || 0])), bytes: n * 28, tiles: tiles.length, ms: Math.round(performance.now() - t0) };
  return S.stats;
}
function ready(P) {
  if (!S.mode || !gl) return false;
  const k = keyOf(P);
  if (k !== S.key && k !== S.want) { S.want = k; clearTimeout(S.pending);
    S.pending = setTimeout(() => { S.pending = 0; try { const first = !S.buf, st = build(C.par()); S.key = k;
      if (first) C.toast(`Line drawing: ${st.edges.toLocaleString('en-GB')} edges, ${(st.bytes / 1048576).toFixed(1)} MB, ${(st.ms / 1000).toFixed(1)} s`); }
      catch (e) { C.toast('Lines did not build: ' + e.message); } S.want = ''; C.draw(); }, 30); }
  return !!S.buf;
}

// ---------- programs
let LP = null, LU = null, QD = null;
function prog(vsrc, fsrc, attrs) { const p = gl.createProgram(); gl.attachShader(p, C.sh(gl.VERTEX_SHADER, vsrc)); gl.attachShader(p, C.sh(gl.FRAGMENT_SHADER, fsrc));
  attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
function programs() {
  if (LP) return;
  // an edge is one instance: corner k (x 0 at a, 1 at b; y -1 or 1 across), ends a and b (model metres), m = layer, rank,
  // size. Each end moves towards the eye by max(0.35 m, 0.3% of the distance) (the plotter's depth tolerance), then the
  // quad is widened on the screen. A building edge fades under lw.y px (rank 0) or 3 lw.y px (rank 1); a ground outline or
  // kerb (rank 2) under lw.y px; rank 3 always.
  LP = prog('precision highp float;attribute vec2 k;attribute vec3 a;attribute vec3 b;attribute vec4 m;' +
    'uniform mat4 M;uniform float vz;uniform vec3 eye;uniform vec2 vp;uniform vec4 lw;uniform vec4 col[7];' +
    'varying vec4 vc;varying float ve;varying float vh;varying float wy;' +
    'vec3 W(vec3 p){return vec3(p.x,p.y*vz,p.z);}' +
    'vec3 T(vec3 w){vec3 d=eye-w;float l=max(length(d),1e-3);return w+d*(max(.35,l*.003)/l);}' +
    'void main(){vec3 A=W(a),B=W(b);vec4 c=col[int(m.x+.5)];float r=m.y,th=r<.5?1.:r<1.5?3.:r<2.5?1.:0.;' +
    'vec4 ca=M*vec4(T(A),1.),cb=M*vec4(T(B),1.);' +
    'if(th>0.){float s=(m.z+m.w*256.)*.25*lw.z/max(.5*(ca.w+cb.w),1.);c.a*=smoothstep(lw.y*th,lw.y*th*1.6,s);}' +
    'float da=ca.z+ca.w,db=cb.z+cb.w;vc=vec4(0.);ve=0.;vh=0.;wy=0.;' +
    'if(c.a<.004||(da<0.&&db<0.)){gl_Position=vec4(2.,2.,2.,1.);return;}' +
    'if(da<0.)ca=mix(ca,cb,da/(da-db));else if(db<0.)cb=mix(cb,ca,db/(db-da));' +
    'if((ca.x>ca.w&&cb.x>cb.w)||(ca.x<-ca.w&&cb.x<-cb.w)||(ca.y>ca.w&&cb.y>cb.w)||(ca.y<-ca.w&&cb.y<-cb.w)){gl_Position=vec4(2.,2.,2.,1.);return;}' +
    'vec2 sa=ca.xy/ca.w*vp*.5,sb=cb.xy/cb.w*vp*.5,d=sb-sa;float L=length(d);d=L>1e-4?d/L:vec2(1.,0.);' +
    'float w=max(lw.x,1.),h=w*.5+1.;c.a*=min(lw.x,1.);vec4 p=k.x<.5?ca:cb;p.xy+=vec2(-d.y,d.x)*(k.y*h*2.*p.w)/vp;' +
    'gl_Position=p;vc=c;ve=k.y*h;vh=w*.5;wy=(k.x<.5?A.y:B.y)/vz;}',
  'precision mediump float;varying vec4 vc;varying float ve;varying float vh;varying float wy;uniform float cut;uniform float add;' +
    'void main(){if(wy>cut)discard;float a=vc.a*clamp(vh+.5-abs(ve),0.,1.);gl_FragColor=add>.5?vec4(vc.rgb*a,1.):vec4(vc.rgb,a);}', ['k', 'a', 'b', 'm']);
  LU = Object.fromEntries(['M', 'vz', 'eye', 'vp', 'lw', 'col', 'cut', 'add'].map(u => [u, gl.getUniformLocation(LP, u)]));
  QD = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, QD); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
}

// ---------- drawing
function colours(f) {
  const roads = !$('showRoads') || $('showRoads').checked, base = PEN();
  if (f.bm === 'off') base[0][3] = 0; else if (f.bm === 'ghost') base[0][3] = .35;
  if (!roads) base[3][3] = 0; if (!f.cutOn) base[6][3] = 0;
  return new Float32Array(base.flat());
}
function drawLines(f, additive) {
  const X = C.instExt, M = C.MVP(), PR = C.PROJ(), E = C.CAM().eye, dpr = f.w / Math.max(1, C.cv.clientWidth);
  gl.useProgram(LP);
  gl.uniformMatrix4fv(LU.M, false, M); gl.uniform1f(LU.vz, C.VZ()); gl.uniform3f(LU.eye, E[0], E[1], E[2]); gl.uniform2f(LU.vp, f.w, f.h);
  gl.uniform4f(LU.lw, W_LINE * dpr, LO * dpr, PR[5] * f.h / 2, 0); gl.uniform4fv(LU.col, colours(f)); gl.uniform1f(LU.cut, Math.min(f.cutY, 1e4)); gl.uniform1f(LU.add, additive ? 1 : 0);
  for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
  gl.bindBuffer(gl.ARRAY_BUFFER, QD); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); X.vertexAttribDivisorANGLE(0, 0);
  for (let i = 1; i < 4; i++) X.vertexAttribDivisorANGLE(i, 1);
  gl.enable(gl.BLEND); if (additive) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  // per tile: skip it when its box is outside the view; else draw its edges down to the size that its nearest depth hides
  // (w is linear, so its least value over the box is at a corner)
  gl.bindBuffer(gl.ARRAY_BUFFER, S.buf); const vz = C.VZ(), lo = LO * dpr / (PR[5] * f.h / 2) * .99; let drawn = 0, calls = 0;
  for (const t of S.tiles) { const B = t.box; let ox = 0, ux = 0, oy = 0, uy = 0, behind = 0, wmin = Infinity;
    for (let c = 0; c < 8; c++) { const x = B[c & 1 ? 3 : 0], y = B[c & 2 ? 4 : 1] * vz, z = B[c & 4 ? 5 : 2], cx = M[0] * x + M[4] * y + M[8] * z + M[12], cy = M[1] * x + M[5] * y + M[9] * z + M[13], cz = M[2] * x + M[6] * y + M[10] * z + M[14], w = M[3] * x + M[7] * y + M[11] * z + M[15];
      if (cx > w) ox++; if (cx < -w) ux++; if (cy > w) oy++; if (cy < -w) uy++; if (cz < -w) behind++; wmin = Math.min(wmin, w); }
    if (ox === 8 || ux === 8 || oy === 8 || uy === 8 || behind === 8) continue;
    const kmin = lo * Math.max(wmin, 1e-3), K = t.keys; let a = 0, b = K.length; while (a < b) { const m = (a + b) >> 1; if (K[m] > kmin) a = m + 1; else b = m; }
    if (!a) continue;
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 28 * t.s); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 28, 28 * t.s + 12); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, false, 28, 28 * t.s + 24);
    X.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, a); drawn += a; calls++; }
  S.drawn = drawn; S.calls = calls;
  for (let i = 0; i < 4; i++) { X.vertexAttribDivisorANGLE(i, 0); if (i !== C.aP && i !== C.aC) gl.disableVertexAttribArray(i); }
  gl.enableVertexAttribArray(C.aP); gl.enableVertexAttribArray(C.aC);
  gl.useProgram(C.pr); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(true);
}
function scene(f, clear, additive) {   // the solids into the depth buffer only, then the edges over them
  gl.clearColor(...clear, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true); gl.colorMask(false, false, false, false);
  f.occlude(); gl.colorMask(true, true, true, true);
  drawLines(f, additive); gl.disable(gl.BLEND); f.top();
}
// f: { P, w, h, cutOn, cutY, bm, occlude(), top() } from the page's render()
function frame(f) {
  programs();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, f.w, f.h); scene(f, [1, 1, 1], false);
}

// ---------- switching
const NOTE = {
  lines: 'Line drawing: the plotter drawing in real time. Building edges with hidden lines removed, and water, parks, roads, railways and paths in the plotter\'s pen colours. A building smaller than 4 px on the screen is left out, and under 12 px only its roof outline is drawn. Night, overlays and splats are off in this style. Menu > "Plotter SVG of this view" makes the file for a pen plotter.',
 };
function set(mode) {
  mode = mode === 'lines' ? mode : null;
  if (mode && !C.instExt) { C.toast('This browser cannot draw the line styles (no instanced drawing).'); return false; }
  S.mode = mode;
  document.body.classList.toggle('lstyle-lines', mode === 'lines');
  const note = $('lineNote'); if (note) { note.hidden = !mode; note.textContent = mode ? NOTE[mode] : ''; }
  if (mode && !S.buf) C.toast('Drawing the lines…');
  C.draw(); return true;
}
function init(ctx) { C = ctx; gl = ctx.gl;
  const m = /[?&](lines)\b/.exec(location.search);   // ?lines
  if (m) setTimeout(() => { const r = document.querySelector(`input[name=style][value=${m[1]}]`); if (r) r.checked = true; C.setStyle(m[1]); }, 50); }
globalThis.DocklandsLines = { init, set, ready, frame, build, get mode() { return S.mode; }, get stats() { return S.stats; }, get drawn() { return { edges: S.drawn, calls: S.calls }; }, get built() { return !!S.buf && !S.pending && !S.want; } };
if (globalThis.DocklandsLinesCtx) init(globalThis.DocklandsLinesCtx);
})();
