// Plotter SVG of the 3D page's current view (Menu > views > "Plotter SVG"): lines only, hidden lines removed, one pen
// layer per kind of line, millimetres on A4/A3/A2 paper. Edges are rebuilt from the page's data; visibility comes from a
// CPU z-buffer of the same solids. index.html calls DocklandsPlot.init(ctx). Skill: docklands-3d-page, "Plotter SVG".
(() => {
let C = null;
const $ = id => document.getElementById(id);
const PAPER = { A4: [297, 210], A3: [420, 297], A2: [594, 420] }, MARGIN = 12, PEN = 0.3;
const LAYERS = [   // id, label, stroke colour (blue only for water)
  ['bld', 'Buildings', '#000000'], ['water', 'Water', '#1f5fbf'], ['green', 'Parks and greens', '#2e8b3a'],
  ['road', 'Roads', '#777777'], ['rail', 'Railways', '#c0392b'], ['path', 'Paths with a level', '#a0784a'],
  ['under', 'Underground (tunnels, stations)', '#d35400']];

// ---------- camera
function camera(W, H) {
  const M = C.MVP(), VZ = C.VZ(), E = C.CAM().eye;
  const clip = (x, y, z) => { const Y = y * VZ; return [M[0] * x + M[4] * Y + M[8] * z + M[12], M[1] * x + M[5] * Y + M[9] * z + M[13], M[2] * x + M[6] * Y + M[10] * z + M[14], M[3] * x + M[7] * Y + M[11] * z + M[15]]; };
  const scr = c => [(c[0] / c[3] * .5 + .5) * W, (1 - (c[1] / c[3] * .5 + .5)) * H, c[2] / c[3]];
  // a point moved towards the eye by a depth tolerance: an edge on a face must win against that face
  const toward = (x, y, z) => { const dx = E[0] - x, dy = E[1] - y * VZ, dz = E[2] - z, d = Math.hypot(dx, dy, dz) || 1, e = Math.max(.35, d * .003) / d; return [x + dx * e, y + dy * e / VZ, z + dz * e]; };
  return { clip, scr, toward };
}
const nearOK = c => c[2] + c[3] > 1e-6;   // inside the near plane (clip z >= -w)

// ---------- z-buffer
function zbuffer(W, H) { const z = new Float32Array(W * H).fill(2); return { W, H, z }; }
function rasterTri(Z, a, b, c) {   // a, b, c: screen [x, y, ndcz]
  const minx = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxx = Math.min(Z.W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const miny = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxy = Math.min(Z.H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  if (minx > maxx || miny > maxy) return;
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (Math.abs(area) < 1e-9) return;
  for (let y = miny; y <= maxy; y++) { const py = y + .5;
    for (let x = minx; x <= maxx; x++) { const px = x + .5;
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area, w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const d = w0 * a[2] + w1 * b[2] + w2 * c[2], k = y * Z.W + x; if (d < Z.z[k]) Z.z[k] = d;
    }
  }
}
function clipPoly(P, inside, cross) {   // Sutherland-Hodgman against one plane
  const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a); if (ia !== ib) out.push(cross(a, b)); } return out;
}
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------- scene
function scene(P, cam, minPx) {
  const cutY = P.cut < 250 ? P.cut : Infinity, O = [], E = Object.fromEntries(LAYERS.map(l => [l[0], []])), seen = new Set();
  const tri = (a, b, c) => O.push(a, b, c);
  const seg = (L, a, b, dedupe) => {
    if (dedupe) { const k1 = a.map(v => Math.round(v * 5)).join() + '|' + b.map(v => Math.round(v * 5)).join(), k2 = k1.split('|').reverse().join('|'); if (seen.has(k1) || seen.has(k2)) return; seen.add(k1); }
    E[L].push(a, b);
  };
  const ringsOf = (f, holes) => { const starts = [0, ...(holes || []), f.length / 2], R = []; for (let r = 0; r < starts.length - 1; r++) { const ring = []; for (let i = starts[r]; i < starts[r + 1]; i++) ring.push([f[2 * i], f[2 * i + 1]]); R.push(ring); } return R; };
  // a building smaller than minPx on the screen still hides what is behind it, but its edges are not drawn
  const small = (rings, y0, y1) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of rings[0]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
    for (const q of [[x0, y0, z0], [x1, y1, z1], [x0, y1, z1], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0]]) { const c = cam.clip(...q); if (!nearOK(c) || c[3] <= 0) return false; const s = cam.scr(c);
      sx0 = Math.min(sx0, s[0]); sx1 = Math.max(sx1, s[0]); sy0 = Math.min(sy0, s[1]); sy1 = Math.max(sy1, s[1]); }
    const sz = Math.max(sx1 - sx0, sy1 - sy0); return sz < minPx ? 2 : sz < 3 * minPx ? 1 : 0; };
  const prism = (rings, y0, y1, roof = true) => {
    if (y0 >= cutY) return; const cut = y1 > cutY; if (cut) y1 = cutY;
    const sz = small(rings, y0, y1), segB = sz === 2 ? () => {} : seg, segD = sz ? () => {} : seg;   // 1: roof outline only
    for (const ring of rings) { const n = ring.length;
      for (let i = 0; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n], o = ring[(i + n - 1) % n];
        tri([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]]); tri([p[0], y0, p[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]);
        segB('bld', [p[0], y1, p[1]], [q[0], y1, q[1]], true); segD('bld', [p[0], y0, p[1]], [q[0], y0, q[1]], true);
        const t1 = Math.atan2(p[1] - o[1], p[0] - o[0]), t2 = Math.atan2(q[1] - p[1], q[0] - p[0]); let d = Math.abs(t2 - t1); if (d > Math.PI) d = 2 * Math.PI - d;
        if (d > .45) segD('bld', [p[0], y0, p[1]], [p[0], y1, p[1]], true);   // a corner of more than about 26 degrees: a vertical edge
      } }
    if (roof && !cut) { const flatv = [], holes = []; for (const r of rings) { if (flatv.length) holes.push(flatv.length / 2); for (const p of r) flatv.push(p[0], p[1]); }
      const t = C.earcut(flatv, holes.length ? holes : undefined, 2); for (let k = 0; k < t.length; k += 3) tri(...[t[k], t[k + 1], t[k + 2]].map(i => [flatv[2 * i], y1, flatv[2 * i + 1]])); }
  };
  // buildings and fitted towers, as the page draws them
  const T = C.TOWERS(), useT = !!T;
  C.A.buildings.forEach((b, i) => { if (useT && C.towerOf.has(i)) return; const h = C.heightOf(b, i); if (!(h > 0)) return; prism(ringsOf(C.dec(b.p), b.holes), b.b + (b.mh || 0), b.b + h); });
  if (useT) for (const t of T) t.tiers.forEach((tr, k) => {
    const pyr = k === t.tiers.length - 1 && t.top && t.top.kind === 'pyramid' && t.top.apex;
    if (!pyr) { prism([tr.ring, ...(tr.holes || [])], tr.y0, tr.y1); return; }
    const [ax, ay, az] = t.top.apex, r = tr.ring; if (tr.y0 >= cutY) return;
    for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; tri([p[0], tr.y0, p[1]], [q[0], tr.y0, q[1]], [ax, ay, az]); seg('bld', [p[0], tr.y0, p[1]], [q[0], tr.y0, q[1]], true); seg('bld', [p[0], tr.y0, p[1]], [ax, ay, az], true); }
  });
  // terrain: an occluder only when the model is not cut open (the page then draws the ground faint)
  if (cutY === Infinity) { const G = C.A.terrain, h = (i, j) => G.dm[j * G.nx + i] / 10;
    for (let j = 0; j < G.nz - 1; j++) for (let i = 0; i < G.nx - 1; i++) { const x0 = G.x0 + i * G.cell, z0 = G.z0 + j * G.cell, x1 = x0 + G.cell, z1 = z0 + G.cell;
      const a = [x0, h(i, j), z0], b = [x1, h(i + 1, j), z0], c = [x0, h(i, j + 1), z1], d = [x1, h(i + 1, j + 1), z1]; tri(a, b, c); tri(b, d, c); } }
  // water and greens: outlines on the surface
  const outline = (L, o, yf) => { for (const ring of ringsOf(C.dec(o.p), o.holes)) for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; if (p[1] === q[1] && p[0] === q[0]) continue; seg(L, [p[0], yf(p[0], p[1]), p[1]], [q[0], yf(q[0], q[1]), q[1]]); } };
  for (const w of C.A.water) outline('water', w, () => w.level + .1);
  for (const g of C.A.greens) outline('green', g, (x, z) => C.groundAt(x, z) + .3);
  // roads (both kerbs) and open railways (centre line)
  for (const l of C.A.lines) if (!l.tunnel) { const q = C.dec(l.q, 3), road = l.k === 'road', w = road ? [0, 10, 7, 4][l.c] / 2 : 0;
    if (road && !w) continue;
    for (let i = 3; i < q.length; i += 3) { const a = [q[i - 3], q[i - 1] + .3, q[i - 2]], b = [q[i], q[i + 2] + .3, q[i + 1]];
      if (!road) { seg('rail', a, b); continue; }
      const dx = b[0] - a[0], dz = b[2] - a[2], n = Math.hypot(dx, dz) || 1, ox = -dz / n * w, oz = dx / n * w;
      seg('road', [a[0] + ox, a[1], a[2] + oz], [b[0] + ox, b[1], b[2] + oz]); seg('road', [a[0] - ox, a[1], a[2] - oz], [b[0] - ox, b[1], b[2] - oz]); } }
  // paths and corridors with a level tag, at the page's heights (station models: measured floors)
  const ST = globalThis.DocklandsStations, U = globalThis.DOCKLANDS_UNDER;
  if (U && $('showUnder') && $('showUnder').checked) for (const o of U.indoor) if (o.line) { const f = C.dec(o.line);
    if (ST && ST.inside(f[0], f[1])) continue;
    for (const lv of o.lv) { const ly = lv < 0 && ST ? ST.levelY(f[0], f[1], lv, o.g) : null, y = ly ?? o.g + lv * P.storey + .2; if (y < C.groundAt(f[0], f[1]) - 1 && cutY === Infinity) continue;
      for (let i = 2; i < f.length; i += 2) seg('path', [f[i - 2], y, f[i - 1]], [f[i], y, f[i + 1]]); } }
  // underground: tunnels and the station models, drawn when the model is cut open
  if (cutY < Infinity) {
    for (const l of C.A.lines) if (l.tunnel) for (let i = 1; i < l.pts.length; i++) { const a = l.pts[i - 1], b = l.pts[i];
      for (const [s, e] of ST ? ST.outside(a[0], a[1], b[0], b[1]) : [[0, 1]]) { const ya = C.tunnelY(l, a, P) + 3, yb = C.tunnelY(l, b, P) + 3;
        seg('under', [a[0] + (b[0] - a[0]) * s, ya + (yb - ya) * s, a[1] + (b[1] - a[1]) * s], [a[0] + (b[0] - a[0]) * e, ya + (yb - ya) * e, a[1] + (b[1] - a[1]) * e]); } }
    if (ST && ST.S.doc && $('showStations') && $('showStations').checked) stationEdges(ST.S.doc, seg, tri);
  }
  return { O, E, cutY };
}
function stationEdges(doc, seg, tri) {   // feature edges: a boundary, or two faces more than 30 degrees apart
  const GLASS = new Set(['box', 'hall', 'canopy']);
  for (const o of doc.objects) { if (o.cls === 'tunnel') continue; const t = o.t, p = o.p, P = k => [t[0] + p[3 * k] / 100, t[1] + p[3 * k + 1] / 100, t[2] + p[3 * k + 2] / 100];
    const nrm = [], edges = new Map();
    for (let k = 0; k < o.i.length; k += 3) { const a = P(o.i[k]), b = P(o.i[k + 1]), c = P(o.i[k + 2]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
      nrm.push(n.map(x => x / l)); if (!GLASS.has(o.cls)) tri(a, b, c);
      for (const [i, j] of [[o.i[k], o.i[k + 1]], [o.i[k + 1], o.i[k + 2]], [o.i[k + 2], o.i[k]]]) { const key = i < j ? i + ',' + j : j + ',' + i; (edges.get(key) || edges.set(key, []).get(key)).push(k / 3); } }
    for (const [key, fs] of edges) { const feature = fs.length === 1 || fs.some(f => { const a = nrm[fs[0]], b = nrm[f]; return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < .866; });
      if (feature) { const [i, j] = key.split(',').map(Number); seg('under', P(i), P(j)); } }
  }
}

// ---------- visibility and polylines
function visibleRuns(Z, cam, cutY, a, b, out) {
  if (a[1] > cutY && b[1] > cutY) return; if (a[1] > cutY || b[1] > cutY) { const t = (cutY - a[1]) / (b[1] - a[1]); if (a[1] > cutY) a = lerp(a, b, t); else b = lerp(a, b, t); }
  let ca = cam.clip(...a), cb = cam.clip(...b), ta = cam.clip(...cam.toward(...a)), tb = cam.clip(...cam.toward(...b));
  const da = ca[2] + ca[3], db = cb[2] + cb[3]; if (da < 0 && db < 0) return;
  if (da < 0 || db < 0) { const t = da / (da - db); if (da < 0) { ca = lerp(ca, cb, t); ta = lerp(ta, tb, t); } else { cb = lerp(ca, cb, t); tb = lerp(ta, tb, t); } }
  if (!nearOK(ca) || !nearOK(cb) || ca[3] <= 0 || cb[3] <= 0) return;
  const A = cam.scr(ca), B = cam.scr(cb), TA = cam.scr(ta), TB = cam.scr(tb), len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if ((A[0] < 0 && B[0] < 0) || (A[0] > Z.W && B[0] > Z.W) || (A[1] < 0 && B[1] < 0) || (A[1] > Z.H && B[1] > Z.H)) return;
  const n = Math.max(1, Math.ceil(len / .75)); let run = null;
  for (let s = 0; s <= n; s++) { const t = s / n, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t, inView = x >= 0 && y >= 0 && x < Z.W && y < Z.H;
    let vis = false; if (inView) { const d = TA[2] + (TB[2] - TA[2]) * t, px = Math.min(Z.W - 1, x | 0), py = Math.min(Z.H - 1, y | 0); vis = d <= Z.z[py * Z.W + px] + 1e-6; }
    if (vis) { if (!run) run = [[x, y]]; else run[1] = [x, y]; } else if (run) { if (run.length > 1) out.push(run); run = null; } }
  if (run && run.length > 1) out.push(run);
}
function chain(segs) {   // join runs that meet end to start (within 0.6 px) into polylines
  const key = p => Math.round(p[0] / .6) + ',' + Math.round(p[1] / .6), starts = new Map(), used = new Uint8Array(segs.length), lines = [];
  segs.forEach((s, i) => { const k = key(s[0]); (starts.get(k) || starts.set(k, []).get(k)).push(i); });
  for (let i = 0; i < segs.length; i++) { if (used[i]) continue; used[i] = 1; const L = [segs[i][0], segs[i][1]];
    for (;;) { const c = (starts.get(key(L[L.length - 1])) || []).find(j => !used[j]); if (c == null) break; used[c] = 1; L.push(segs[c][1]); }
    lines.push(L); }
  return lines;
}
function simplify(pts, tol) {   // Douglas-Peucker
  if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [i, j] = st.pop(), [ax, ay] = pts[i], [bx, by] = pts[j], L = Math.hypot(bx - ax, by - ay) || 1e-9; let best = -1, bd = tol;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / L; if (d > bd) { bd = d; best = k; } }
    if (best > 0) { keep[best] = 1; st.push([i, best], [best, j]); } }
  return pts.filter((_, k) => keep[k]);
}
function order(lines) {   // greedy nearest start (either end) to cut pen-up travel
  const out = [], left = lines.slice(); let at = [0, 0];
  while (left.length) { let bi = 0, bd = Infinity, rev = false;
    for (let i = 0; i < left.length; i++) { const L = left[i], d0 = (L[0][0] - at[0]) ** 2 + (L[0][1] - at[1]) ** 2, d1 = (L[L.length - 1][0] - at[0]) ** 2 + (L[L.length - 1][1] - at[1]) ** 2;
      if (d0 < bd) { bd = d0; bi = i; rev = false; } if (d1 < bd) { bd = d1; bi = i; rev = true; } }
    let L = left.splice(bi, 1)[0]; if (rev) L = L.slice().reverse(); out.push(L); at = L[L.length - 1]; }
  return out;
}

// ---------- the SVG
function make(opts = {}) {
  const t0 = performance.now(), cv = $('c'), W0 = cv.clientWidth, H0 = cv.clientHeight, s = Math.min(2, 2400 / Math.max(W0, H0)), W = Math.round(W0 * s), H = Math.round(H0 * s);
  const [pw0, ph0] = PAPER[opts.paper || 'A3'], land = W >= H, PW = land ? pw0 : ph0, PH = land ? ph0 : pw0;
  const k = Math.min((PW - 2 * MARGIN) / W, (PH - 2 * MARGIN - 6) / H), ox = (PW - W * k) / 2, oy = MARGIN + (PH - 2 * MARGIN - 6 - H * k) / 2;
  const P = C.par(), cam = camera(W, H), Z = zbuffer(W, H), { O, E, cutY } = scene(P, cam, (opts.minMm ?? 1) / k);
  // occluders: clip to the cut level and the near plane, then fill the z-buffer
  let nTri = 0;
  for (let k = 0; k < O.length; k += 3) { let poly = [O[k], O[k + 1], O[k + 2]];
    if (cutY < Infinity) { poly = clipPoly(poly, p => p[1] <= cutY, (a, b) => lerp(a, b, (cutY - a[1]) / (b[1] - a[1]))); if (poly.length < 3) continue; }
    let cp = poly.map(p => cam.clip(...p)); if (cp.every(c => c[0] > c[3]) || cp.every(c => c[0] < -c[3]) || cp.every(c => c[1] > c[3]) || cp.every(c => c[1] < -c[3])) continue;
    cp = clipPoly(cp, c => c[2] + c[3] >= 1e-6, (a, b) => { const da = a[2] + a[3], db = b[2] + b[3]; return lerp(a, b, da / (da - db)); }); if (cp.length < 3) continue;
    const sp = cp.map(cam.scr); for (let i = 1; i < sp.length - 1; i++) { rasterTri(Z, sp[0], sp[i], sp[i + 1]); nTri++; } }
  // edges -> visible polylines, in mm on the paper
  const tol = .08 / k, stats = {}, groups = [];
  for (const [id, label, col] of LAYERS) { const runs = [], segs = E[id];
    for (let i = 0; i < segs.length; i += 2) visibleRuns(Z, cam, cutY, segs[i], segs[i + 1], runs);
    const lines = order(chain(runs).map(L => simplify(L, tol)).filter(L => L.length > 1 && L.reduce((a, p, i) => i ? a + Math.hypot(p[0] - L[i - 1][0], p[1] - L[i - 1][1]) : 0, 0) * k > .25));
    stats[id] = lines.length; if (!lines.length) continue;
    const d = lines.map(L => 'M' + L.map(p => `${(ox + p[0] * k).toFixed(2)} ${(oy + p[1] * k).toFixed(2)}`).join('L')).join('');
    groups.push(`<g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}" stroke="${col}"><path d="${d}"/></g>`); }
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const credit = `Docklands 3D, ${when} UTC. © OpenStreetMap contributors (ODbL). Heights: Environment Agency LiDAR (OGL v3.0).`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}">\n` +
    `<title>Docklands 3D: plotter drawing of the current view</title><desc>${credit} Hidden lines removed.</desc>\n` +
    `<g fill="none" stroke-width="${PEN}" stroke-linecap="round" stroke-linejoin="round">\n${groups.join('\n')}\n</g>\n` +
    `<g id="credit" inkscape:groupmode="layer" inkscape:label="Credit" fill="#000"><text x="${MARGIN}" y="${PH - MARGIN + 2}" font-family="sans-serif" font-size="3">${credit.replace(/&/g, '&amp;')}</text></g>\n</svg>\n`;
  return { svg, stats, ms: Math.round(performance.now() - t0), raster: [W, H], occluders: nTri, paper: [PW, PH] };
}
function download() {
  const paper = ($('plotPaper') || {}).value || 'A3'; C.toast('Drawing the plot…');
  setTimeout(() => { try { const r = make({ paper }), url = URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml' })), a = document.createElement('a');
    a.href = url; a.download = `docklands-plot-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${paper}.svg`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    C.toast(`Plotter SVG saved (${paper}, ${Object.values(r.stats).reduce((a, b) => a + b, 0).toLocaleString()} lines, ${(r.svg.length / 1024).toFixed(0)} kB).`);
  } catch (e) { C.toast('Plot failed: ' + e.message); } }, 30);
}
function injectUi() {
  const sb = $('shareOut') || $('shareBtn'); if (!sb) return false;
  const row = document.createElement('div'); row.id = 'plotRow'; row.className = 'row';
  row.innerHTML = '<button type="button" id="plotBtn">Plotter SVG of this view</button> <select id="plotPaper" aria-label="Paper size"><option>A4</option><option selected>A3</option><option>A2</option></select>';
  sb.after(row); $('plotBtn').onclick = download; return true;
}
function init(ctx) { C = ctx; if (!injectUi()) document.addEventListener('DOMContentLoaded', injectUi, { once: true }); }
globalThis.DocklandsPlot = { init, make, download };
if (globalThis.DocklandsPlotCtx) init(globalThis.DocklandsPlotCtx);
})();
