// Turns the real OSM building footprints (data/buildings-*.json, fetched by
// tools/fetch-buildings.mjs) into a proper-looking skyline: every footprint
// and height is real, but on top of that each tower gets architectural
// detailing — stepped setbacks, tapered crowns, spires + antennas on the
// tallest, rooftop mechanical boxes, the odd water tower, and floor-banded
// glass/stone/concrete facades. The goal is "a city skyline", not "extruded
// rectangles".

import * as THREE from '../vendor/three.module.min.js';
import { LONDON_WORLD_Z, NYC_WORLD_Z } from './ua17-route.js';
import { landmarkModel } from './ua17-landmarks.js';
import { CITY_GROUND_Y } from './ua17-terrain.js';

// Real footprints span a whole ~2km downtown; compress toward the centre so
// they read as a skyline beside the path rather than a field it flies through.
const SKYLINE_SCALE = 0.36;

// Facade families, weighted so GLASS towers dominate (a modern skyline reads
// as blue/teal glass, not tan stone boxes). A mild self-colour emissive stops
// any face going black on the shadow side (a distant building is only a few
// px, so a dark-average material minifies to a silhouette). `w` is the pick
// weight.
const FAMILIES = [
  { name: 'glass', w: 5, colors: [0x5b8fc9, 0x4f86c6, 0x6fa6d6, 0x3f9fb0, 0x5fb0c4, 0x7fbfe0], roughness: 0.16, metalness: 0.55, emissive: 0.22 },
  { name: 'glass-teal', w: 3, colors: [0x3fa0a0, 0x4fb0aa, 0x5fbfc0, 0x6ec9c0], roughness: 0.18, metalness: 0.5, emissive: 0.22 },
  { name: 'steel', w: 2, colors: [0x9fb2c0, 0x8ea6b6, 0xafc0cc], roughness: 0.35, metalness: 0.5, emissive: 0.18 },
  { name: 'stone', w: 1, colors: [0xcabaa0, 0xbfae93, 0xd3c4a8], roughness: 0.75, metalness: 0.05, emissive: 0.2 },
];
const FAMILY_TOTAL_W = FAMILIES.reduce((s, f) => s + f.w, 0);
function pickFamily(r) {
  let acc = 0;
  for (const f of FAMILIES) { acc += f.w / FAMILY_TOTAL_W; if (r <= acc) return f; }
  return FAMILIES[0];
}

let sharedFacade = null;
function facadeTexture() {
  if (sharedFacade) return sharedFacade;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const ctx = c.getContext('2d');
  // Light spandrel base with darker mullions + floor lines, sparse lit windows.
  ctx.fillStyle = '#dfe4e6';
  ctx.fillRect(0, 0, c.width, c.height);
  const cols = 5, floors = 16;
  const cw = c.width / cols, fh = c.height / floors;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw, y = f * fh;
      // window glass
      const lit = Math.random() < 0.10;
      ctx.fillStyle = lit ? 'rgba(255,226,150,0.95)' : `rgba(120,140,152,${0.4 + Math.random() * 0.25})`;
      ctx.fillRect(x + 1.5, y + 1.5, cw - 3, fh - 3);
    }
  }
  // darker floor lines for a stronger horizontal rhythm
  ctx.fillStyle = 'rgba(70,80,88,0.5)';
  for (let f = 0; f <= floors; f++) ctx.fillRect(0, f * fh - 0.5, c.width, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedFacade = tex;
  return tex;
}

function beacon(height, color = 0xffe0a0) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.set(24, 24, 1);
  sprite.position.y = height + 8;
  return sprite;
}

// Deterministic-ish hash so a given building always looks the same.
function hash(i, salt) { return Math.abs(Math.sin((i + 1) * 12.9898 + salt * 78.233)) % 1; }

// Soft contact-shadow texture (radial dark blob) shared by all buildings —
// grounds them so they read as sitting IN the world, not placed on a plane.
let sharedShadowTex = null;
function shadowTexture() {
  if (sharedShadowTex) return sharedShadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  sharedShadowTex = new THREE.CanvasTexture(c);
  return sharedShadowTex;
}
function contactShadow(span) {
  const mat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(span * 1.7, span * 1.7), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.12; // just above the ground pad, avoids z-fighting
  m.renderOrder = 2;
  return m;
}

function scaledPoints(footprint, factor, cx, cz) {
  return footprint.map(([x, z]) => {
    const sx = x * SKYLINE_SCALE, sz = -z * SKYLINE_SCALE;
    return [cx + (sx - cx) * factor, cz + (sz - cz) * factor];
  });
}

function shapeFrom(points) {
  const s = new THREE.Shape();
  points.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
  return s;
}

function tierMesh(points, from, to, mat) {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(points), { depth: to - from, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, from, 0);
  return new THREE.Mesh(geo, mat);
}

function footprintMetrics(footprint) {
  let cx = 0, cz = 0;
  const pts = footprint.map(([x, z]) => [x * SKYLINE_SCALE, -z * SKYLINE_SCALE]);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of pts) { cx += x; cz += z; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  cx /= pts.length; cz /= pts.length;
  // Shoelace area (scaled units) — used to reject degenerate footprints that
  // extrude to nothing and leave only a floating roof-cap slab.
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; }
  return { cx, cz, w: maxX - minX, d: maxZ - minZ, area: Math.abs(a) / 2 };
}

function buildOneBuilding(b, index, isLandmark) {
  const group = new THREE.Group();
  // CRITICAL: scale height by the SAME factor as the footprint, or towers come
  // out ~3x too thin and read as needles/cones instead of buildings.
  const H = b.height * SKYLINE_SCALE;
  const { cx, cz, w, d, area } = footprintMetrics(b.footprint);
  const span = Math.max(w, d);

  // Reject degenerate/tiny footprints — they extrude to nothing and would
  // otherwise leave a floating roof-cap slab hovering over the ground.
  if (!isLandmark && (area < 12 || span < 4)) return group;

  // Iconic named landmarks get a bespoke recognisable model.
  const icon = landmarkModel(b.name, cx, cz, span, H);
  if (icon) {
    icon.traverse((o) => { if (o.isMesh) o.name = b.name; });
    const sh = contactShadow(span); sh.position.set(cx, 0.12, cz); icon.add(sh);
    return icon;
  }

  const fam = isLandmark ? FAMILIES[0] : pickFamily(hash(index, 3));
  const color = isLandmark ? 0xdcc487 : fam.colors[Math.floor(hash(index, 7) * fam.colors.length)];
  const mat = new THREE.MeshStandardMaterial({
    map: facadeTexture().clone(),
    color,
    roughness: fam.roughness,
    metalness: fam.metalness,
    emissive: color,
    emissiveIntensity: fam.emissive,
  });
  // Tile the facade: rows of windows up the height, a couple of bays across.
  mat.map.needsUpdate = true;
  mat.map.repeat.set(Math.max(1, Math.round(span / 9)), Math.max(2, Math.round(H / 9)));

  const base = scaledPoints(b.footprint, 1, cx, cz);

  // ONE clean extrusion of the REAL footprint to full height. No scaled
  // setback tiers (they self-intersect on concave footprints and leave flat
  // floating slabs) and no detached roof boxes/caps (those became the
  // "floating slabs"). Tall towers get a single centred crown BOX — box
  // geometry can't self-intersect, so it never produces stray slabs.
  group.add(tierMesh(base, 0, H, mat));

  // Roof-cap variety for silhouette rhythm along the skyline top edge. All caps
  // are CENTRED boxes/cylinders/cones — geometry that can't self-intersect, so
  // this never reproduces the old concave-footprint "floating slab" bug.
  if (H > 40) {
    const style = hash(index, 11);
    const w0 = span * 0.5, d0 = span * 0.44;
    if (style < 0.42) {
      // simple mechanical crown box
      const crown = new THREE.Mesh(new THREE.BoxGeometry(w0, H * 0.13, d0), mat);
      crown.position.set(cx, H + H * 0.065, cz);
      group.add(crown);
    } else if (style < 0.78) {
      // stepped double crown — two shrinking boxes for a tiered top
      const c1h = H * 0.11, c2h = H * 0.09;
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(w0, c1h, d0), mat);
      c1.position.set(cx, H + c1h / 2, cz);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(w0 * 0.62, c2h, d0 * 0.62), mat);
      c2.position.set(cx, H + c1h + c2h / 2, cz);
      group.add(c1, c2);
    } else {
      // slender spire/mast on a low base — punctuates the tallest towers
      const baseh = H * 0.08;
      const capBase = new THREE.Mesh(new THREE.BoxGeometry(w0 * 0.7, baseh, d0 * 0.7), mat);
      capBase.position.set(cx, H + baseh / 2, cz);
      const spireH = H * (0.24 + hash(index, 13) * 0.2);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(span * 0.12, spireH, 8), mat);
      spire.position.set(cx, H + baseh + spireH / 2, cz);
      group.add(capBase, spire);
    }
  }

  const sh = contactShadow(span); sh.position.set(cx, 0.12, cz); group.add(sh);

  group.traverse((o) => { if (o.isMesh && !o.name) o.name = b.name || 'building'; });
  return group;
}

// Radius (scaled units) of the dense downtown core we keep around the
// centroid. Real footprints include sparse far-flung outliers that would
// splay the "city" into a 900-wide band; trimming to the core lets us place
// a compact, recognisable skyline as a close flyby beside the path.
const CORE_RADIUS = 170;

export function buildSkyline(data, worldZ, worldX = 0) {
  // Centroid of the whole set.
  let cx0 = 0, cz0 = 0;
  const metrics = data.buildings.map((b) => footprintMetrics(b.footprint));
  for (const m of metrics) { cx0 += m.cx; cz0 += m.cz; }
  cx0 /= metrics.length; cz0 /= metrics.length;

  // Keep the core + always the three tallest (the landmarks).
  const sorted = [...data.buildings].sort((a, b) => b.height - a.height);
  const landmarkNames = new Set(sorted.slice(0, 3).map((b) => b.name).filter(Boolean));
  const kept = data.buildings.filter((b, i) => {
    const m = metrics[i];
    const near = Math.hypot(m.cx - cx0, m.cz - cz0) < CORE_RADIUS;
    return near || (b.name && landmarkNames.has(b.name));
  });

  // Recentre the kept core on its own centroid so it sits neatly at the flyby.
  let cx = 0, cz = 0;
  for (const b of kept) { const m = footprintMetrics(b.footprint); cx += m.cx; cz += m.cz; }
  cx /= kept.length; cz /= kept.length;

  const inner = new THREE.Group();
  kept.forEach((b, i) => {
    const isLandmark = b.name && landmarkNames.has(b.name);
    inner.add(buildOneBuilding(b, i, isLandmark));
  });
  inner.position.set(-cx, 0, -cz);

  const shifted = new THREE.Group();
  shifted.add(inner);
  // Sit the city on the terrain's coastal land plateau (no floating grey slab).
  shifted.position.set(worldX, CITY_GROUND_Y, worldZ);
  return shifted;
}

// Landmarks sit at their footprint origin, roughly under the flight path;
// offset each skyline sideways so the plane flies PAST the city (sightseeing)
// rather than through the tallest tower.
// Close flyby: core spread is ~±CORE_RADIUS, so an offset of ~330 keeps the
// nearest tower ~70 units off the path — a dramatic wall of towers beside the
// wing without ever crossing the flight path.
export const LONDON_WORLD_X = -235;
export const NYC_WORLD_X = 235;

export function buildLondonSkyline(londonData) {
  return buildSkyline(londonData, LONDON_WORLD_Z, LONDON_WORLD_X);
}

export function buildNycSkyline(nycData) {
  return buildSkyline(nycData, NYC_WORLD_Z, NYC_WORLD_X);
}
