// Docklands 3D: "My KML" (Menu > Layers > My KML). Open a .kml or .kmz from the file picker, a drop on the page or ?kml=<url>
// (same origin or CORS); draw its Placemarks with the page's geo() and groundAt(); a record card per feature; remove; go to a
// KML Camera or LookAt; and "Export view as KML" (the camera as a KML Camera, plus the selected building's outline, the
// visible works-in-progress sites and river items, and your own KML) as a download. Nothing is uploaded or stored.
// An ES module loaded after the page script; index.html gives it its helpers in globalThis.DocklandsKMLctx and draws
// OV.kml (opaque) and OV.kmlA (see-through). Parser and writer: kml.js (shared with the atlas).
// Supported subset, limits and lessons: skill docklands-3d-page, section "KML".
import { readKml, writeKml, download, isKmlName, isKmlType, cssColor } from './kml.js';

const C = globalThis.DocklandsKMLctx;
const $ = id => document.getElementById(id);
const S = { files: [], seq: 0, hits: [], polys: [], labels: [], n: {} };
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const DEF = { line: [1, .8, 0, 1], poly: [1, .8, 0, .4], icon: [1, .8, 0, 1] };   // no style in the file: yellow, as a pin in Google Earth

// ---------- coordinates: geo() is the page's WGS84 -> model transform; its inverse by Newton steps (for the export)
function lonLatOf(x, z) {
  const G = C.A.meta.geo; let lon = G.lon0 + (x - G.x[0]) / G.x[1], lat = G.lat0 + (z - G.z[0]) / G.z[2];
  for (let k = 0; k < 8; k++) {
    const [fx, fz] = C.geo(lon, lat), e = 1e-5, [ax, az] = C.geo(lon + e, lat), [bx, bz] = C.geo(lon, lat + e);
    const j00 = (ax - fx) / e, j01 = (bx - fx) / e, j10 = (az - fz) / e, j11 = (bz - fz) / e, det = j00 * j11 - j01 * j10, rx = x - fx, rz = z - fz;
    lon += (j11 * rx - j01 * rz) / det; lat += (-j10 * rx + j00 * rz) / det; if (Math.hypot(rx, rz) < 1e-4) break;
  }
  return [lon, lat];
}
const heightAt = (x, z, alt, mode, lift) => mode === 'absolute' ? alt : /^relativeTo/.test(mode || '') ? C.groundAt(x, z) + (alt || 0) : C.groundAt(x, z) + lift;

// ---------- drawing
const quadA = (M, p, col, a) => { const s = C.shade(col, 0, 1, 0), i = M.v(...p[0], s, a), j = M.v(...p[1], s, a), k = M.v(...p[2], s, a), l = M.v(...p[3], s, a); M.tri(i, j, k); M.tri(i, k, l); };
function pointIn(ring, x, z) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function clipSeg(a, b) {   // Liang-Barsky: the part of a segment inside the model box, or null
  const E = C.A.meta.extent, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; let t0 = 0, t1 = 1;
  for (const [p, q] of [[-d[0], a[0] - E.x0], [d[0], E.x1 - a[0]], [-d[2], a[2] - E.z0], [d[2], E.z1 - a[2]]]) {
    if (p === 0) { if (q < 0) return null; continue; } const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } }
  const at = t => [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t]; return t1 - t0 > 1e-9 ? [at(t0), at(t1)] : null;
}
function lineOn(M, pts, w, col, clamp, st) {   // pts: [x, y, z]; a clamped line follows the ground every 15 m
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1], b = pts[i]; if (!C.inBox(a[0], a[2]) || !C.inBox(b[0], b[2])) { const c = clipSeg(a, b); st.clipped = true; if (!c) continue; [a, b] = c; }
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = clamp ? Math.max(1, Math.ceil(L / 15)) : 1; let p = a;
    for (let k = 1; k <= n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, q = [x, clamp ? C.groundAt(x, z) + 1 : a[1] + (b[1] - a[1]) * t, z];
      C.beam(M, p, q, w, 1.2, col); p = q; }
    st.drawn = true;
  }
}
function featureMesh(f, MO, MA, st) {
  const sty = f.style, set = sty.set || {};
  const lineCol = set.line ? sty.line : DEF.line, polyCol = set.poly ? sty.poly : DEF.poly, iconCol = set.icon ? sty.icon : DEF.icon;
  const w = Math.max(2.5, Math.min(30, (sty.width || 1) * 2));
  for (const g of f.geoms) {
    const mode = g.altitudeMode || 'clampToGround', clamp = !/^(absolute|relativeTo)/.test(mode);
    if (g.type === 'Point') {
      const [x, z] = C.geo(g.coords[0], g.coords[1]); if (!C.inBox(x, z)) { st.clipped = true; continue; }
      const gy = C.groundAt(x, z), y = clamp ? gy : heightAt(x, z, g.coords[2], mode, 0), top = Math.max(y, gy) + 22 * Math.max(.6, Math.min(2.5, sty.scale || 1));
      C.beam(MO, [x, gy, z], [x + .01, top, z], 1.6, 1.6, [.92, .93, .95]); C.beam(MO, [x, top, z], [x + .01, top + 8, z], 8, 8, iconCol.slice(0, 3));
      if (!clamp && Math.abs(y - gy) > 2) C.beam(MO, [x - 4, y, z], [x + 4, y, z], 1.5, 1.5, iconCol.slice(0, 3));   // the altitude itself, on the stick
      st.drawn = true; st.anchor = st.anchor || [x, top + 6, z]; st.labelAt = st.labelAt || [x, top + 10, z];
    } else if (g.type === 'LineString') {
      const pts = g.coords.map(c => { const [x, z] = C.geo(c[0], c[1]); return [x, heightAt(x, z, c[2], mode, 1), z]; });
      lineOn(MO, pts, w, lineCol.slice(0, 3), clamp, st);
      if (g.extrude && !clamp) for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (!C.inBox(a[0], a[2]) || !C.inBox(b[0], b[2])) continue;
        quadA(MA, [[a[0], C.groundAt(a[0], a[2]), a[2]], [b[0], C.groundAt(b[0], b[2]), b[2]], [b[0], b[1], b[2]], [a[0], a[1], a[2]]], lineCol, .35); }
      const m = pts[pts.length >> 1]; if (C.inBox(m[0], m[2])) st.anchor = st.anchor || [m[0], m[1] + 4, m[2]];
    } else if (g.type === 'Polygon') {
      const rings = g.rings.map(r => r.map(c => { const [x, z] = C.geo(c[0], c[1]); return [x, z, c[2]]; }));
      const outer = rings[0], holes = rings.slice(1), inAll = rings.every(r => r.every(p => C.inBox(p[0], p[1])));
      if (!outer.some(p => C.inBox(p[0], p[1]))) { st.clipped = true; continue; }
      if (!inAll) st.clipped = true;
      const bb = outer.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]);
      const r2 = r => r.map(p => [p[0], p[1]]);
      if (sty.fill !== false) {
        if (clamp) {   // drape the fill over the ground: every terrain cell whose centre is inside (holes out); small shapes by earcut
          const T = C.A.terrain, i0 = Math.max(0, Math.floor((bb[0] - T.x0) / T.cell)), i1 = Math.min(T.nx - 2, Math.ceil((bb[2] - T.x0) / T.cell)),
            j0 = Math.max(0, Math.floor((bb[1] - T.z0) / T.cell)), j1 = Math.min(T.nz - 2, Math.ceil((bb[3] - T.z0) / T.cell)); let cells = 0;
          const H = (i, j) => T.dm[j * T.nx + i] / 10 + .8, P = (i, j) => [T.x0 + i * T.cell, H(i, j), T.z0 + j * T.cell];
          const R0 = r2(outer), RH = holes.map(r2);
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx = T.x0 + (i + .5) * T.cell, cz = T.z0 + (j + .5) * T.cell;
            if (!pointIn(R0, cx, cz) || RH.some(h => pointIn(h, cx, cz))) continue; quadA(MA, [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], polyCol, polyCol[3]); cells++; }
          if (!cells) earcutFill(MA, rings, (x, z) => C.groundAt(x, z) + .8, polyCol);
        } else earcutFill(MA, rings, (x, z, a) => heightAt(x, z, a, mode, 0), polyCol);
      }
      if (sty.outline !== false || sty.fill === false) for (const r of rings) {
        const pts = r.map(([x, z, a]) => [x, clamp ? C.groundAt(x, z) + 1 : heightAt(x, z, a, mode, 0), z]); if (pts.length > 1) pts.push(pts[0]);
        lineOn(MO, pts, Math.max(2, w * .7), lineCol.slice(0, 3), clamp, st);
      }
      if (g.extrude && !clamp) for (const r of rings) for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; if (!C.inBox(a[0], a[1]) || !C.inBox(b[0], b[1])) continue;
        quadA(MA, [[a[0], C.groundAt(a[0], a[1]), a[1]], [b[0], C.groundAt(b[0], b[1]), b[1]], [b[0], heightAt(b[0], b[1], b[2], mode, 0), b[1]], [a[0], heightAt(a[0], a[1], a[2], mode, 0), a[1]]], polyCol, Math.max(.25, polyCol[3])); }
      st.drawn = true;
      const c = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], cy = clamp ? C.groundAt(c[0], c[1]) : heightAt(c[0], c[1], outer[0][2], mode, 0);
      if (C.inBox(c[0], c[1])) st.anchor = st.anchor || [c[0], cy + 3, c[1]];
      st.polys.push({ ring: r2(outer), holes: holes.map(r2), bb });
    }
  }
}
function earcutFill(M, rings, yOf, col) {
  const flat = [], holes = [], ys = [];
  for (const r of rings) { if (flat.length) holes.push(flat.length / 2); for (const [x, z, a] of r) { flat.push(x, z); ys.push(yOf(x, z, a)); } }
  const t = C.earcut(flat, holes.length ? holes : undefined, 2), s = C.shade(col, 0, 1, 0), base = M.n;
  for (let i = 0; i < ys.length; i++) M.v(flat[2 * i], ys[i], flat[2 * i + 1], s, col[3]);
  for (let k = 0; k < t.length; k += 3) M.tri(base + t[k], base + t[k + 1], base + t[k + 2]);
}

function rebuild() {
  const OV = C.OV; for (const k of ['kml', 'kmlA']) if (OV[k]) { OV[k].free(); OV[k] = null; }
  for (const l of S.labels.splice(0)) { l.el.remove(); const i = C.labels.indexOf(l); if (i >= 0) C.labels.splice(i, 1); }
  S.hits = []; S.polys = []; const MO = new C.Mesh(), MA = new C.Mesh(), n = { files: 0, features: 0, drawn: 0, clipped: 0, outside: 0, hidden: 0 };
  for (const F of S.files) { if (!F.on) continue; n.files++;
    F.n = { drawn: 0, clipped: 0, outside: 0, hidden: 0 };
    F.doc.features.forEach((f, i) => {
      if (f.removed) return; n.features++; if (!f.visible) { F.n.hidden++; return; }
      const st = { drawn: false, clipped: false, anchor: null, labelAt: null, polys: [] }; featureMesh(f, MO, MA, st);
      if (!st.drawn) { F.n.outside++; return; } F.n.drawn++; if (st.clipped) F.n.clipped++;
      const card = () => featureCard(F, f);
      if (st.anchor) S.hits.push({ x: st.anchor[0], y: st.anchor[1], z: st.anchor[2], kml: true, card });
      for (const p of st.polys) S.polys.push({ ...p, pri: -1, kml: true, card });
      if (f.name && st.labelAt) addLabel(f.name, ...st.labelAt, card, f.style);
    });
    for (const k of ['drawn', 'clipped', 'outside', 'hidden']) n[k] += F.n[k];
  }
  OV.kml = MO.n ? MO.upload() : null; OV.kmlA = MA.n ? MA.upload() : null; S.n = n; sync(); list(); C.labels.sort((a, b) => b.pri - a.pri); C.draw();
}
function sync() {   // buildOverlays() replaces OV.hits and OV.polys: put ours back (in front, so your own shapes answer a tap first)
  const OV = C.OV;
  if (S.hits.length ? !OV.hits.some(o => o.kml) || OV.hits.filter(o => o.kml).length !== S.hits.length : OV.hits.some(o => o.kml)) OV.hits = OV.hits.filter(o => !o.kml).concat(S.hits);
  if (S.polys.length ? !OV.polys.some(o => o.kml) || OV.polys.filter(o => o.kml).length !== S.polys.length : OV.polys.some(o => o.kml)) OV.polys = S.polys.concat(OV.polys.filter(o => !o.kml));
}
function addLabel(name, x, y, z, card, sty) {
  const l = { name: String(name).slice(0, 60), x, y, z, pri: 3, cls: 'kml' }, el = document.createElement('button');
  el.type = 'button'; el.className = 'lb kml'; el.textContent = l.name; el.onclick = card; if (sty && sty.set && sty.set.icon) el.style.borderColor = cssColor(sty.icon);
  C.labelBox.appendChild(el); l.el = el; C.labels.push(l); S.labels.push(l);
}

// ---------- record card: every text from the file goes in with textContent (a <script> in a description is text)
const E = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) if (k === 'text') e.textContent = v; else if (k === 'on') e.onclick = v; else e.setAttribute(k, v); for (const c of kids) if (c) e.append(c); return e; };
function featureCard(F, f) {
  C.ovCard('<div id="kmlCard"></div>'); const box = $('kmlCard');
  box.append(E('b', { text: f.name || '(no name)' }), ' ', E('span', { class: 'small', text: `My KML · ${F.name}${f.path.length ? ' · ' + f.path.join(' / ') : ''}` }));
  if (f.snippet && f.snippet !== f.description) box.append(E('p', { class: 'small', text: f.snippet }));
  if (f.description) box.append(E('p', { class: 'small kmlDesc', text: f.description }));
  if (f.address) box.append(E('p', { class: 'small', text: 'Address: ' + f.address }));
  if (f.extended.length) { const t = E('table', { class: 'small' }); for (const [k, v] of f.extended) t.append(E('tr', {}, E('td', { text: k }), E('td', { text: v }))); box.append(t); }
  const kinds = f.geoms.map(g => g.type + (g.type === 'Polygon' && g.rings.length > 1 ? ` with ${g.rings.length - 1} hole${g.rings.length > 2 ? 's' : ''}` : '') + (g.altitudeMode && g.altitudeMode !== 'clampToGround' ? ` (${g.altitudeMode})` : '')).join(', ');
  box.append(E('p', { class: 'small', text: `${kinds}. From your file "${F.file}": shown only in this browser, not uploaded.` }));
  const row = E('div', { class: 'row' });
  if (f.view) row.append(E('button', { type: 'button', text: 'Go to view', on: () => goView(f.view) }));
  row.append(E('button', { type: 'button', text: 'Remove this feature', on: () => { f.removed = true; C.ovCard('<p class="small">Removed from My KML.</p>'); rebuild(); } }));
  box.append(row);
}

// ---------- camera: KML Camera / LookAt to the page camera and back
function goView(v) {
  const cam = C.cam, VZ = C.VZ || 1, [x, z] = C.geo(v.lon, v.lat);
  const alt = v.altitudeMode === 'absolute' ? v.alt : /^relativeTo/.test(v.altitudeMode) ? C.groundAt(x, z) + v.alt : C.groundAt(x, z) + (v.type === 'Camera' ? Math.max(1.6, v.alt || 0) : 0);
  delete cam.eye; delete cam.target; delete cam.fov; delete cam.hfov;
  if (v.type === 'LookAt') {
    const p = Math.max(.02, Math.min(1.5695, (90 - v.tilt) * D2R));
    Object.assign(cam, { tx: x, ty: alt, tz: z, yaw: -v.heading * D2R, pitch: p, dist: Math.max(80, Math.min(16000, v.range || 1000)) });
  } else {   // Camera: the eye, the heading and the tilt (0 straight down, 90 level); roll is not used
    const a = v.heading * D2R, p = (v.tilt - 90) * D2R, D = 1200;
    Object.assign(cam, { tx: x + D * Math.sin(a) * Math.cos(p), ty: alt + D * Math.sin(p) / VZ, tz: z - D * Math.cos(a) * Math.cos(p), yaw: -a, pitch: Math.max(-1.5695, Math.min(1.5695, -p)), dist: D });
  }
  if (Number.isFinite(v.horizFov) && v.horizFov > 1 && v.horizFov < 170) cam.hfov = v.horizFov * D2R;
  else if (v.type === 'Camera') cam.hfov = 60 * D2R;   // no gx:horizFov: Google Earth's default horizontal field, the same on a phone and a desktop
  C.unview(); C.draw();
}
function currentView() {   // the camera as drawn (CAM): eye in m OD, heading from north, tilt from straight down, horizontal field
  const K = C.CAM; if (!K) return null; const VZ = C.VZ || 1;
  const e = [K.eye[0], K.eye[1] / VZ, K.eye[2]], t = [K.target[0], K.target[1] / VZ, K.target[2]], d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]];
  const [lon, lat] = lonLatOf(e[0], e[2]), heading = ((Math.atan2(d[0], -d[2]) * R2D) % 360 + 360) % 360, tilt = 90 + Math.atan2(d[1], Math.hypot(d[0], d[2])) * R2D;
  return { type: 'Camera', lon, lat, alt: e[1], heading, tilt, roll: 0, altitudeMode: 'absolute', horizFov: 2 * Math.atan(Math.tan(K.fovY / 2) * K.aspect) * R2D };
}
function frame(F) {   // fit the camera to a file's drawn features (keeps the turn and the tilt)
  let b = [1e9, 1e9, -1e9, -1e9];
  for (const f of F.doc.features) if (!f.removed && f.visible) for (const g of f.geoms) for (const c of g.type === 'Point' ? [g.coords] : g.type === 'LineString' ? g.coords : g.rings[0]) {
    const [x, z] = C.geo(c[0], c[1]); if (!C.inBox(x, z)) continue; b = [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)]; }
  if (b[0] > b[2]) return false; const cam = C.cam, cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2;
  delete cam.eye; delete cam.target; delete cam.fov; delete cam.hfov;
  Object.assign(cam, { tx: cx, ty: C.groundAt(cx, cz), tz: cz, dist: Math.max(300, Math.min(16000, 1.5 * Math.hypot(b[2] - b[0], b[3] - b[1]) + 200)) }); C.unview(); C.draw(); return true;
}

// ---------- import
async function open(src, name, how) {
  try {
    const doc = await readKml(src, name); const F = { id: ++S.seq, name: doc.name || name, file: name, doc, on: true, how };
    S.files.push(F); rebuild();
    const v = doc.view || (doc.features.length === 1 && doc.features[0].view); if (v) goView(v); else frame(F);
    const sk = Object.entries(doc.skipped).map(([k, n]) => `${n} ${k}`).join(', ');
    C.toast(`${F.name}: ${F.n.drawn} of ${doc.features.length} features drawn${F.n.outside ? `, ${F.n.outside} outside the model` : ''}${F.n.clipped ? `, ${F.n.clipped} cut at its edge` : ''}${F.n.hidden ? `, ${F.n.hidden} hidden in the file` : ''}${sk ? `; not supported: ${sk}` : ''}.`);
    return F;
  } catch (e) { C.toast(`${name}: not opened (${e.message})`); console.warn('KML', name, e); return null; }
}
function list() {
  const el = $('kmlList'); if (!el) return; el.textContent = '';
  for (const F of S.files) {
    const d = F.doc, n = F.n || {}, live = d.features.filter(f => !f.removed).length;
    const row = E('div', { class: 'kmlFile' });
    const cb = E('input', { type: 'checkbox' }); cb.checked = F.on; cb.onchange = () => { F.on = cb.checked; rebuild(); };
    row.append(E('label', {}, cb, ' ', E('b', { text: F.name })));
    const sk = Object.entries(d.skipped).map(([k, c]) => `${c} ${k}`).join(', ');
    row.append(E('div', { class: 'small', text: `${live} features: ${n.drawn || 0} drawn${n.outside ? `, ${n.outside} outside the model box (not drawn)` : ''}${n.clipped ? `, ${n.clipped} partly outside (cut at the edge)` : ''}${n.hidden ? `, ${n.hidden} hidden in the file (visibility 0)` : ''}${d.folders.n ? `; ${d.folders.n} folders` : ''}${d.kmz ? `; KMZ (${d.kmz.entry})` : ''}${sk ? `; not supported: ${sk}` : ''}.` }));
    if (d.description) row.append(E('div', { class: 'small kmlDesc', text: d.description.slice(0, 400) }));
    const r = E('div', { class: 'row' });
    r.append(E('button', { type: 'button', text: 'Show', on: () => frame(F) || C.toast('Nothing of this file is inside the model.') }));
    if (d.view) r.append(E('button', { type: 'button', text: 'Go to view', on: () => goView(d.view) }));
    r.append(E('button', { type: 'button', text: 'Remove', on: () => { S.files.splice(S.files.indexOf(F), 1); rebuild(); } }));
    row.append(r); el.append(row);
  }
}
async function openFiles(files, how) { const out = []; for (const f of files) if (isKmlName(f.name) || isKmlType(f.type)) out.push(await open(f, f.name, how)); return out; }

// ---------- export
const WC = { on_site: [1, .55, .12, 1], approved_not_started: [.95, .86, .3, 1], completed_recently: [.45, .86, .6, 1], proposed: [.62, .72, .98, 1], commenced_stale: [.6, .6, .62, 1] };   // the page's WCOL
const OSM_CREDIT = '© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)';
const RIVER = { rbus: [['bus', i => i.kind === 'pier']], rlocks: [['locks', () => true]], rpla: [['pla', () => true]], rswim: [['eden', () => true], ['royal', () => true]],
  rmoor: [['osm', i => /^(mooring|houseboat)$/.test(i.kind)], ['moor', () => true]], rships: [['wd', () => true], ['osm', i => i.kind === 'ship']] };
function exportView(opts = {}) {
  const v = currentView(); if (!v) throw new Error('the model is not drawn yet');
  const credits = new Set(), folders = [], now = new Date(), osm = { used: false };
  const want = k => opts[k] ?? (($('kx_' + k) || {}).checked ?? true);
  // the selected building: its OSM outline at the LiDAR roof height
  const ab = C.sel && C.sel();
  if (ab && want('sel')) {
    const pms = ab.mi.map(i => { const b = C.A.buildings[i], f = C.dec(b.p), ring = []; for (let k = 0; k < f.length; k += 2) { const [lon, lat] = lonLatOf(f[k], f[k + 1]); ring.push([lon, lat, b.b + b.h]); }
      return { type: 'Polygon', rings: [ring], altitudeMode: 'absolute', extrude: true }; });
    folders.push({ name: 'Selected building', placemarks: [{ name: ab.n || ab.id, description: `Registry record ${ab.id}. Outline ${OSM_CREDIT}; roof height (m above Ordnance Datum Newlyn, about mean sea level) from Environment Agency LiDAR, OGL v3.0.`,
      extended: [['registry id', ab.id], ['roof m OD', +(Math.max(...ab.mi.map(i => C.A.buildings[i].b + C.A.buildings[i].h))).toFixed(1)], ['outline licence', OSM_CREDIT], ['atlas', `https://danbri.github.io/glitchcan-minigam/magpie/cwplans/atlas/#map/b/${ab.id}`]],
      style: { line: [1, .25, .65, 1], width: 3, poly: [1, .25, .65, .35] }, geoms: pms }] });
    osm.used = true; credits.add('Selected building outline: ' + OSM_CREDIT + '. Roof height: Environment Agency LiDAR DSM 1 m, © Environment Agency copyright and/or database right, OGL v3.0.');
  }
  // works in progress (when the layer is on)
  const wd = C.ovOn('works') && C.OV.data.works;
  if (wd && want('works')) {
    const pms = [];
    for (const s of wd.sites) { const fp = s.footprint, ring = fp && fp.ring_wgs84; if (!WC[s.status] || !ring || ring.length < 3) continue; const [cx, cz] = C.geo(s.position.lon, s.position.lat); if (!C.inBox(cx, cz)) continue;
      const fromOsm = /\bOSM\b|OpenStreetMap/i.test(fp.from || ''); if (fromOsm) osm.used = true;
      pms.push({ name: s.name || s.id, style: { line: WC[s.status] || [.6, .6, .6, 1], width: 2, poly: [...(WC[s.status] || [.6, .6, .6]).slice(0, 3), .3] },
        extended: [['id', s.id], ['status', s.status], ['status rule', s.status_rule], ['status confidence', s.status_confidence], ['address', s.address], ['borough', s.borough],
          ['decision', s.dates && s.dates.decision], ['commenced', s.dates && s.dates.commenced], ['completed', s.dates && s.dates.completed], ['dates from', s.dates && s.dates.from],
          ['storeys (approved, max)', s.approved && s.approved.storeys_max], ['footprint from', fp.from], ['footprint licence', fromOsm ? OSM_CREDIT : 'Planning London Datahub: facts and links only']],
        geoms: [{ type: 'Polygon', rings: [ring.map(c => [c[0], c[1], 0])] }] });
    }
    folders.push({ name: 'Works in progress', description: 'Construction sites in the model box, by status (orange on site, yellow approved and not started, green completed in the last two years, blue proposed, grey commenced years ago and never closed).', placemarks: pms });
    for (const src of Object.values((wd.meta && wd.meta.sources) || {})) if (src.attribution) credits.add(`Works in progress: ${src.attribution}${src.licence ? ` (${src.licence})` : ''}`);
  }
  // river items (the river layers that are on)
  const RV = globalThis.DocklandsRiver && DocklandsRiver.RV;
  if (RV && want('river')) {
    const pms = [], seen = new Set();
    for (const [k, parts] of Object.entries(RIVER)) { if (!C.ovOn(k)) continue;
      for (const [file, keep] of parts) { const d = RV.data[file]; if (!d || !d.items) continue;
        for (const i of d.items) { if (!keep(i) || !i.position || i.position.lat == null || seen.has(i.id)) continue; const [x, z] = C.geo(i.position.lon, i.position.lat); if (!C.inBox(x, z)) continue; seen.add(i.id);
          const fromOsm = /OpenStreetMap|\bOSM\b/i.test(`${(d.meta && d.meta.attribution) || ''} ${i.position.precision || ''}`) && (file === 'osm' || /OSM/.test(i.position.precision || '')); if (fromOsm) osm.used = true;
          const vals = Object.entries(i.values || {}).filter(([, v]) => v != null && v !== '' && typeof v !== 'object').slice(0, 20);
          pms.push({ name: i.name || i.title || (i.values && i.values.name) || i.id, style: { icon: [.2, .6, 1, 1] },
            extended: [['id', i.id], ['kind', i.kind], ['url', i.url], ['position from', i.position.precision], ...vals, ['source', d.meta && d.meta.attribution], ...(fromOsm ? [['position licence', OSM_CREDIT]] : [])],
            geoms: [{ type: 'Point', coords: [i.position.lon, i.position.lat, 0] }] });
          if (d.meta && d.meta.attribution) credits.add(`River: ${d.meta.attribution}${d.meta.licence ? ` (licence: ${String(d.meta.licence).slice(0, 160)})` : ''}`); } } }
    if (pms.length) folders.push({ name: 'River', description: 'River layers that were on: piers, locks, harbour notices, swim water, moorings and houseboats, historic ships (positions as points; facts only).', placemarks: pms });
  }
  // your own KML, as drawn now
  if (want('mine')) for (const F of S.files) { if (!F.on) continue;
    const pms = F.doc.features.filter(f => !f.removed).map(f => ({ name: f.name, description: f.description, extended: f.extended, view: f.view, geoms: f.geoms,
      style: { line: f.style.line, width: f.style.width, poly: f.style.poly, fill: f.style.fill, outline: f.style.outline, icon: f.style.icon } }));
    if (pms.length) folders.push({ name: `My KML: ${F.name}`, description: F.doc.description, placemarks: pms }); credits.add(`My KML "${F.file}": your own file, under its own terms.`);
  }
  if (osm.used) credits.add('Map data: ' + OSM_CREDIT + '. Geometry marked with it is OpenStreetMap-derived.');
  const page = 'https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/';
  const desc = `View exported from the Docklands 3D page (${page}) on ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC. Camera: eye at ${v.alt.toFixed(1)} m above Ordnance Datum Newlyn (about mean sea level; KML absolute altitude), heading ${v.heading.toFixed(1)}°, tilt ${v.tilt.toFixed(1)}°, horizontal field ${v.horizFov.toFixed(1)}° (gx:horizFov).\n\nCredits and licences:\n- ${[...credits].join('\n- ') || 'camera only'}\n\nFull credits: ${page} (Menu > About > Credits). Not for navigation.`;
  const name = `Docklands view ${now.toISOString().slice(0, 10)}`;
  const text = writeKml({ name, description: desc, view: v, folders });
  return { text, view: v, count: folders.reduce((s, f) => s + f.placemarks.length, 0), folders: folders.map(f => [f.name, f.placemarks.length]), osm: osm.used, filename: `docklands-view-${now.toISOString().slice(0, 16).replace(/[-:T]/g, '')}.kml` };
}

// ---------- the page's side
function injectUi() {
  const css = document.createElement('style');
  css.textContent = '.lb.kml{border:1px solid #ffd000;border-radius:5px;background:#0d1013cc;color:#fff3b0;padding:0 3px}.kmlFile{border-top:1px solid #ffffff22;padding:6px 0}.kmlDesc{white-space:pre-wrap;overflow-wrap:anywhere}#kmlCard table td{vertical-align:top;overflow-wrap:anywhere}#kmlCard table td:first-child{color:#aab;padding-right:8px}';
  document.head.appendChild(css);
  const html = `<h3>My KML</h3>
    <div class="row"><button type="button" id="kmlOpen">Open KML/KMZ</button><button type="button" id="kmlExport">Export view as KML</button>
    <input type="file" id="kmlFile" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" multiple hidden></div>
    <details><summary class="small">What the export holds</summary><div class="chips">
      <label><input type="checkbox" checked disabled> The camera (KML Camera)</label><label><input type="checkbox" id="kx_sel" checked> The selected building</label>
      <label><input type="checkbox" id="kx_works" checked> Works in progress (when on)</label><label><input type="checkbox" id="kx_river" checked> River items (layers on)</label>
      <label><input type="checkbox" id="kx_mine" checked> My KML</label></div></details>
    <div id="kmlList"></div>
    <details id="kmlEx"><summary class="small">Example KML (open data)</summary><div class="chips" id="kmlExList"></div><p class="small">Open-licensed layers clipped to the zone (TfL, Walk Wheel Cycle Trust, Canal &amp; River Trust, Natural England, Historic England, GLA; the licence and credits are in each file). More, with the licences and the files that cannot be opened here: <a href="https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/feeds/kml/README.md" target="_blank" rel="noopener">KML sources</a>.</p></details>
    <p class="small" id="kmlNote">Open a KML or KMZ file, or drop one on the city: points, lines and polygons (with holes), folders, styles, descriptions (as text) and data tables; a KML Camera or LookAt gives "Go to view". The file stays in this browser: nothing is uploaded or stored.</p>`;
  const pane = $('paneLayers'), first = pane && pane.querySelector('h3'); if (first) first.insertAdjacentHTML('beforebegin', html); else if (pane) pane.insertAdjacentHTML('afterbegin', html);
  const inp = $('kmlFile');
  $('kmlOpen').onclick = () => inp.click();
  inp.onchange = async () => { const fs = [...inp.files]; inp.value = ''; await openFiles(fs, 'picker'); };
  $('kmlExport').onclick = () => { try { const r = exportView(); download(r.text, r.filename); C.toast(`Exported the view${r.count ? ` and ${r.count} placemarks` : ''} as ${r.filename}.`); } catch (e) { C.toast('Export failed: ' + e.message); } };
  const mus = [...document.querySelectorAll('#credits h3')].find(h => /Music and software/.test(h.textContent));
  if (mus) mus.insertAdjacentHTML('beforebegin', '<h3>My KML</h3><ul class="small"><li>Your own KML and KMZ files are read in this browser and drawn only for you; they are not uploaded or stored. Their content is under their own terms.</li><li>"Export view as KML" writes the credits and licences of what it holds into the file (OpenStreetMap-derived outlines: © OpenStreetMap contributors, ODbL 1.0).</li></ul>');
  // a dropped .kml or .kmz goes to the importer (the window lock in index.html keeps the page from navigating; audio still goes to the player)
  addEventListener('dragover', e => { const it = [...((e.dataTransfer && e.dataTransfer.items) || [])]; if (it.some(i => i.kind === 'file' && (isKmlType(i.type) || !i.type || /xml|zip/.test(i.type)))) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  addEventListener('drop', e => { const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])].filter(f => isKmlName(f.name) || isKmlType(f.type)); if (!fs.length) return; e.preventDefault(); openFiles(fs, 'drop'); });
}
// examples: open-licensed, zone-clipped copies in danbri/londat (CORS *); the list and the licences: feeds/kml/catalogue.json
const EXAMPLE_BASE = 'https://raw.githubusercontent.com/danbri/londat/main/cwplans/feeds/kml/';
const EXAMPLES = [['Thames Path', 'ne-thames-path'], ['Cycle routes (TfL)', 'tfl-cycle-routes'], ['National Cycle Network', 'sustrans-ncn'], ['River piers (TfL)', 'tfl-river-piers'],
  ['River services (TfL)', 'tfl-river-services'], ['Locks (CRT)', 'crt-locks'], ['World Heritage Sites', 'he-world-heritage'], ['Listed buildings', 'he-listed-buildings'],
  ['Heritage at Risk', 'he-heritage-at-risk'], ['Conservation areas', 'gla-conservation-areas'], ['Wards (2014)', 'lds-wards-2016-zone']];
function examples() {
  const el = $('kmlExList'); if (!el) return;
  for (const [t, id] of EXAMPLES) el.append(E('button', { type: 'button', text: t, on: () => { if (S.files.some(F => F.file === id + '.kml')) return C.toast(`${t} is open already (My KML).`); loadUrl(EXAMPLE_BASE + id + '.kml'); } }));
}
async function fromUrl() {
  const m = /[?&]kml=([^&#]+)/.exec(location.search); if (!m) return;
  return loadUrl(decodeURIComponent(m[1].replace(/\+/g, ' ')));
}
async function loadUrl(u) {
  try { const url = new URL(u, location.href); if (!/^https?:$/.test(url.protocol)) throw new Error('only http(s) addresses');
    const r = await fetch(url, { credentials: 'omit' }); if (!r.ok) throw new Error('HTTP ' + r.status);
    await open(await r.arrayBuffer(), decodeURIComponent(url.pathname.split('/').pop() || 'KML'), 'url'); }
  catch (e) { C.toast(`The KML link did not load (${e.message}). The server must allow this site to read it (CORS).`); }
}
if (C) {
  injectUi(); examples(); setInterval(sync, 1000);
  globalThis.DocklandsKML = { open, openFiles, rebuild, exportView, currentView, goView, lonLatOf, get S() { return S; } };
  fromUrl();
}
