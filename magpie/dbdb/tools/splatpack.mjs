#!/usr/bin/env node
/* splatpack.mjs — clip reusable ELEMENTS out of the splat corpus:
   walls, windows, doors, pumps, cars — the clone-stamp for reality.

   Each element is cut with an ORIENTED BOX (world coords, same frame
   as dream.html's registry/walls/stations), then CANONICALIZED:
     - rotated so the scan's up is world +y and the box's facing
       bearing becomes +z (every element faces the same way),
     - centred on x/z, floored so its base sits at y=0,
     - ghosts (alpha < 25) dropped.
   So a derived scene builds by STAMPING: translate/yaw/scale per
   instance, no per-element fixup. SH is already degree 0 in this
   corpus, so no SH rotation is needed and no baked reflections
   survive — the one honest artifact is source lighting in the paint.

   Pipeline: source (.sog/.ply/.splat) → splat-transform → work .splat
   → box filter + canonicalize (32-byte records) → element .splat →
   splat-transform → element .compressed.ply + pack.json entry.

   Usage:
     node splatpack.mjs clip --scene carshop --id pump \
       --c -0.72,-0.2,5.04 --yaw -143.5 --size 1.8,3.2,1.8
     node splatpack.mjs list
*/
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DBDB = path.resolve(HERE, '..');
const PACK = path.join(DBDB, 'splats/pack');
const WORK = path.join(HERE, 'pack-work');

/* the scenes we clip from — src + scan-up + credit, mirrored from
   dream.html's registry (keep in sync when adding source scenes) */
const SRC = {
  tree:   { src: 'splats/christmas-tree-150k.splat', up: [-0.522, 0.836, 0.168],
            hqsrc: 'splats/christmas-tree-400k.compressed.ply',
            credit: 'ChristmasTree · keijiro-tk/splat-data · The Unlicense' },
  garden: { src: 'splats/garden-sog/meta.json', up: [0, -1, 0], cdn: '6f697c4d',
            credit: 'Botanical Garden Kiel, Victoria House · Simon Bethke · superspl.at/scene/6f697c4d · CC BY 4.0' },
  carshop:{ src: 'splats/carshop.sog', up: [0, -1, 0], cdn: 'dd8d9c8b',
            credit: 'Nelson Ghost Town Car Shop · Paolo Tosolini · superspl.at/scene/dd8d9c8b · CC BY 4.0' },
  forest: { src: 'splats/forest.sog', up: [0, -1, 0], cdn: '2be1a75a',
            credit: 'Forest path · Pavel Tanhauser · superspl.at/scene/2be1a75a · CC BY 4.0' },
  museum: { src: 'splats/museum.sog', up: [0, -1, 0],
            credit: 'Buffalo AKG Art Museum · Justin Eastman · superspl.at/scene/fadf93a0 · CC BY 4.0' },
  pool:   { src: 'splats/pool.sog', up: [0, -1, 0],
            credit: 'Apartment Pool · paul · superspl.at/scene/9d145adb · CC BY 4.0' },
  watertower:{ src: 'splats/watertower.sog', up: [0, -1, 0], cdn: 'fb3b5ed5',
            credit: 'Nelson Ghost Town Water Tower · Paolo Tosolini · superspl.at/scene/fb3b5ed5 · CC BY 4.0' },
  calico: { src: 'splats/calico.sog', up: [0, -1, 0],
            credit: 'Calico Tanks Trail, Red Rock Canyon · Paolo Tosolini · superspl.at/scene/19312f07 · CC BY 4.0' },
};

/* ---------- tiny quaternion kit (w,x,y,z) ---------- */
const qMul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qFromAxisAngle = (ax, ang) => {
  const s = Math.sin(ang / 2), l = Math.hypot(...ax) || 1;
  return [Math.cos(ang / 2), ax[0] / l * s, ax[1] / l * s, ax[2] / l * s];
};
const qRotVec = (q, v) => {
  const qv = [0, v[0], v[1], v[2]];
  const r = qMul(qMul(q, qv), [q[0], -q[1], -q[2], -q[3]]);
  return [r[1], r[2], r[3]];
};
/* rotation FROM vector a TO vector b (unit) */
const qBetween = (a, b) => {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d > 0.99999) return [1, 0, 0, 0];
  /* antiparallel: MUST match dream.html's rotationTo (x-axis flip),
     or the tool's world frame is horizontally flipped vs the game's */
  if (d < -0.99999) return qFromAxisAngle([1, 0, 0], Math.PI);
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const w = 1 + d, l = Math.hypot(w, ...c);
  return [w / l, c[0] / l, c[1] / l, c[2] / l];
};

const st = (args) => execFileSync('npx', ['-y', '@playcanvas/splat-transform', '-w', ...args],
  { stdio: ['ignore', 'inherit', 'inherit'] });
/* curl (not node fetch): it honours the environment's HTTPS proxy */
const curl = (url, dest) => execFileSync('curl', ['-sSf', url, '-o', dest], { stdio: 'inherit' });
const CDN_BASE = 'https://d28zzqy0iyovbz.cloudfront.net/';

/* FULL-RESOLUTION sourcing: the SuperSplat LOD tree tells us which
   finest-LOD tiles intersect a clip sphere — we fetch ONLY those.
   A small box cut from an 18M-gaussian scan stays a small file. */
function hqBufferFor(sceneKey, cScan, radius) {
  const meta = SRC[sceneKey];
  if (meta.hqsrc) {                       // local HQ (tree's 400k cut)
    fs.mkdirSync(WORK, { recursive: true });
    const out = path.join(WORK, sceneKey + '-hq.splat');
    if (!fs.existsSync(out)) st([path.join(DBDB, meta.hqsrc), out]);
    return fs.readFileSync(out);
  }
  if (!meta.cdn) return null;
  const hqDir = path.join(WORK, 'hq', sceneKey);
  fs.mkdirSync(hqDir, { recursive: true });
  const lodPath = path.join(hqDir, 'lod-meta.json');
  if (!fs.existsSync(lodPath)) curl(CDN_BASE + meta.cdn + '/v1/lod-meta.json', lodPath);
  const lod = JSON.parse(fs.readFileSync(lodPath, 'utf8'));
  const hit = b => {                       // sphere vs aabb, scan space
    let d = 0;
    for (let k = 0; k < 3; k++) {
      const v = cScan[k];
      if (v < b.min[k]) d += (b.min[k] - v) ** 2;
      else if (v > b.max[k]) d += (v - b.max[k]) ** 2;
    }
    return d <= radius * radius;
  };
  const files = new Set();
  const walk = n => {
    if (!hit(n.bound)) return;
    if (n.children && n.children.length) { n.children.forEach(walk); return; }
    if (n.lods && n.lods[0]) files.add(n.lods[0].file);
  };
  walk(lod.tree);
  if (!files.size) throw new Error('no HQ tiles intersect the clip sphere');
  const bufs = [];
  for (const fi of files) {
    const rel = lod.filenames[fi];                    // e.g. "0_3/meta.json"
    const tileDir = path.join(hqDir, path.dirname(rel));
    const tileSplat = tileDir + '.splat';
    if (!fs.existsSync(tileSplat)) {
      fs.mkdirSync(tileDir, { recursive: true });
      const mPath = path.join(tileDir, 'meta.json');
      curl(CDN_BASE + meta.cdn + '/v1/' + rel, mPath);
      const tm = JSON.parse(fs.readFileSync(mPath, 'utf8'));
      const names = new Set();
      const scoop = o => { if (!o || typeof o !== 'object') return;
        for (const v of Object.values(o)) {
          if (typeof v === 'string' && v.endsWith('.webp')) names.add(v);
          else scoop(v);
        } };
      scoop(tm);
      console.log('· tile', rel, '—', names.size, 'planes');
      for (const nm of names)
        curl(CDN_BASE + meta.cdn + '/v1/' + path.dirname(rel) + '/' + nm,
          path.join(tileDir, nm));
      st([mPath, tileSplat]);
    }
    bufs.push(fs.readFileSync(tileSplat));
  }
  console.log('· HQ source:', files.size, 'tile(s),',
    Math.floor(Buffer.concat(bufs).length / 32), 'gaussians');
  return Buffer.concat(bufs);
}
/* inverse of qRotVec's rotation */
const qConj = q => [q[0], -q[1], -q[2], -q[3]];

function ensureWorkSplat(sceneKey) {
  const meta = SRC[sceneKey];
  if (!meta) throw new Error('unknown scene ' + sceneKey);
  const srcPath = path.join(DBDB, meta.src);
  if (srcPath.endsWith('.splat')) return srcPath;      // already raw
  fs.mkdirSync(WORK, { recursive: true });
  const out = path.join(WORK, sceneKey + '.splat');
  if (!fs.existsSync(out)) {
    console.log('· decompressing', meta.src, '→ work splat');
    st([srcPath, out]);
  }
  return out;
}

function clip(opts) {
  const { scene, id, c, yaw, size, trim = 0, mode = 'solid', band = 0.35,
          hq = false, max = 140000, tint = null } = opts;
  const meta = SRC[scene];
  let raw = null;
  const u0 = meta.up, ul0 = Math.hypot(...u0);
  const upQ0 = qBetween([u0[0] / ul0, u0[1] / ul0, u0[2] / ul0], [0, 1, 0]);
  if (hq) {
    const cScan = qRotVec(qConj(upQ0), c);            // world -> scan space
    const radius = Math.hypot(size[0], size[1], size[2]) / 2 * 1.25;
    try { raw = hqBufferFor(scene, cScan, radius); }
    catch (e) { console.log('! HQ source unavailable (' + e.message + '), using shipped scene'); }
  }
  if (!raw) raw = fs.readFileSync(ensureWorkSplat(scene));
  const n = Math.floor(raw.length / 32);
  /* upQ: scan up → +y (same construction as dream.html's rotationTo) */
  const u = meta.up, ul = Math.hypot(...u);
  const upQ = qBetween([u[0] / ul, u[1] / ul, u[2] / ul], [0, 1, 0]);
  const yawQ = qFromAxisAngle([0, 1, 0], -yaw * Math.PI / 180);   // facing → +z
  const totQ = qMul(yawQ, upQ);
  const [hw, hh, hd] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const keep = [];
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  for (let i = 0; i < n; i++) {
    const o = i * 32;
    if (raw[o + 27] < 25) continue;                    // ghosts stay home
    const pw = qRotVec(upQ, [dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)]);
    const rel = [pw[0] - c[0], pw[1] - c[1], pw[2] - c[2]];
    const pl = qRotVec(yawQ, rel);                     // box-local
    if (Math.abs(pl[0]) > hw || Math.abs(pl[1]) > hh || Math.abs(pl[2]) > hd) continue;
    keep.push({ o, p: pl });
  }
  if (keep.length < 500) throw new Error('only ' + keep.length + ' gaussians in the box — check c/yaw/size');
  /* the travelling-floor problem: scans drag their ground along.
     --trim T   cuts everything below floor+T (solid elements)
     --mode floor keeps ONLY the floor band (ground filler tiles) */
  { const ys0 = keep.map(k => k.p[1]).sort((a, b) => a - b);
    const fl = ys0[Math.floor(ys0.length * 0.03)];
    let kept2;
    if (mode === 'floor') kept2 = keep.filter(k => k.p[1] >= fl && k.p[1] <= fl + band);
    else if (trim > 0)    kept2 = keep.filter(k => k.p[1] >= fl + trim);
    else kept2 = keep;
    if (kept2.length >= 500) { keep.length = 0; for (const k of kept2) keep.push(k); }
    else console.log('! trim/band left', kept2.length, 'gaussians — keeping untrimmed'); }
  /* density cap: HQ clips can be huge — thin uniformly, deterministic */
  if (keep.length > max) {
    const stride = keep.length / max;
    const thin = [];
    for (let f = 0; f < keep.length; f += stride) thin.push(keep[Math.floor(f)]);
    console.log('· thinned', keep.length, '->', thin.length);
    keep.length = 0; for (const k of thin) keep.push(k);
  }
  /* canonicalize: centre x/z on the kept mass, floor y at the 3rd pct */
  const xs = keep.map(k => k.p[0]).sort((a, b) => a - b);
  const zs = keep.map(k => k.p[2]).sort((a, b) => a - b);
  const ys = keep.map(k => k.p[1]).sort((a, b) => a - b);
  const cx = (xs[0] + xs[xs.length - 1]) / 2, cz = (zs[0] + zs[zs.length - 1]) / 2;
  const y0 = ys[Math.floor(ys.length * 0.02)];
  const out = Buffer.alloc(keep.length * 32);
  keep.forEach((k, j) => {
    raw.copy(out, j * 32, k.o, k.o + 32);
    out.writeFloatLE(k.p[0] - cx, j * 32);
    out.writeFloatLE(k.p[1] - y0, j * 32 + 4);
    out.writeFloatLE(k.p[2] - cz, j * 32 + 8);
    if (tint)                                   // colour variants for stamping
      for (let m = 0; m < 3; m++)
        out[j * 32 + 24 + m] = Math.max(0, Math.min(255, Math.round(out[j * 32 + 24 + m] * tint[m])));
    /* rotate the gaussian's own quaternion (stored w,x,y,z as u8*128+128) */
    const q = [out[j * 32 + 28], out[j * 32 + 29], out[j * 32 + 30], out[j * 32 + 31]]
      .map(b => (b - 128) / 128);
    const q2 = qMul(totQ, q);
    const l = Math.hypot(...q2) || 1;
    for (let m = 0; m < 4; m++)
      out[j * 32 + 28 + m] = Math.max(0, Math.min(255, Math.round(q2[m] / l * 128 + 128)));
  });
  fs.mkdirSync(PACK, { recursive: true });
  const rawOut = path.join(WORK, id + '.splat');
  fs.writeFileSync(rawOut, out);
  const ply = path.join(PACK, id + '.compressed.ply');
  st([rawOut, ply]);
  const dims = [xs[xs.length - 1] - xs[0], ys[ys.length - 1] - y0, zs[zs.length - 1] - zs[0]]
    .map(v => +v.toFixed(2));
  /* pack.json: the catalogue, with the CC attribution each clip owes */
  const pj = path.join(PACK, 'pack.json');
  const pack = fs.existsSync(pj) ? JSON.parse(fs.readFileSync(pj, 'utf8')) : { elements: [] };
  pack.elements = pack.elements.filter(e => e.id !== id);
  pack.elements.push({ id, file: id + '.compressed.ply', scene, mode,
    box: { c, yaw, size, trim, band }, hq: !!raw && hq, count: keep.length, dims,
    credit: meta.credit });
  pack.elements.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(pj, JSON.stringify(pack, null, 2));
  console.log('✓', id, '—', keep.length, 'gaussians, dims', dims.join(' × '),
    '→', path.relative(process.cwd(), ply));
}

/* ---------- CLI ---------- */
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
if (cmd === 'clip') {
  clip({ scene: opt('scene'), id: opt('id'),
    c: opt('c').split(',').map(Number),
    yaw: +opt('yaw', 0),
    size: opt('size').split(',').map(Number),
    trim: +opt('trim', 0),
    mode: opt('mode', 'solid'),
    band: +opt('band', 0.35),
    hq: argv.includes('--hq'),
    max: +opt('max', 140000),
    tint: opt('tint') ? opt('tint').split(',').map(Number) : null });
} else if (cmd === 'reclip') {
  /* the point of storing the box metadata: go back to the SOURCE.
     Re-cuts every element from the full-resolution scans. */
  const pj = path.join(PACK, 'pack.json');
  const pack = JSON.parse(fs.readFileSync(pj, 'utf8'));
  for (const e of pack.elements.slice()) {
    console.log('— reclip', e.id, 'from', e.scene, '(HQ)');
    clip({ scene: e.scene, id: e.id, c: e.box.c, yaw: e.box.yaw, size: e.box.size,
      trim: e.box.trim || 0, mode: e.mode || 'solid', band: e.box.band || 0.4,
      hq: true, max: +opt('max', 140000) });
  }
} else if (cmd === 'list') {
  const pj = path.join(PACK, 'pack.json');
  const pack = fs.existsSync(pj) ? JSON.parse(fs.readFileSync(pj, 'utf8')) : { elements: [] };
  for (const e of pack.elements)
    console.log(e.id.padEnd(14), String(e.count).padStart(7), 'g ',
      e.dims.join('×').padEnd(18), e.scene.padEnd(8), e.credit.split('·')[0].trim());
} else {
  console.log('usage: splatpack.mjs clip --scene K --id NAME --c x,y,z --yaw DEG --size w,h,d | list');
}
