// Turns the real OSM building footprints (data/buildings-*.json, fetched by
// tools/fetch-buildings.mjs) into a proper-looking skyline: every footprint
// and height is real, but on top of that each tower gets architectural
// detailing — stepped setbacks, tapered crowns, spires + antennas on the
// tallest, rooftop mechanical boxes, the odd water tower, and floor-banded
// glass/stone/concrete facades. The goal is "a city skyline", not "extruded
// rectangles".

import * as THREE from '../vendor/three.module.min.js';
import { LONDON_WORLD_Z, NYC_WORLD_Z } from './ua17-route.js';

// Real footprints span a whole ~2km downtown; compress toward the centre so
// they read as a skyline beside the path rather than a field it flies through.
const SKYLINE_SCALE = 0.32;

// Facade families. Glass towers are cool + a touch reflective; stone/concrete
// are warmer/matte. A mild self-colour emissive stops any face going black on
// the shadow side (a distant building is only a few px, so a dark-average
// material minifies to a silhouette).
const FAMILIES = [
  { name: 'glass', colors: [0x6f97b5, 0x5f8fb0, 0x7fa9c0, 0x88b7c9, 0x6aa0a8], roughness: 0.25, metalness: 0.5, emissive: 0.16 },
  { name: 'steel', colors: [0x9fb0bb, 0x8ea1ad, 0xaab6bd], roughness: 0.4, metalness: 0.4, emissive: 0.14 },
  { name: 'concrete', colors: [0xb7b9b4, 0xa7aaa4, 0xc3c2ba], roughness: 0.75, metalness: 0.05, emissive: 0.16 },
  { name: 'stone', colors: [0xcabaa0, 0xbfae93, 0xd3c4a8], roughness: 0.8, metalness: 0.04, emissive: 0.18 },
];

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
  return { cx, cz, w: maxX - minX, d: maxZ - minZ };
}

function buildOneBuilding(b, index, isLandmark) {
  const group = new THREE.Group();
  const H = b.height;
  const { cx, cz, w, d } = footprintMetrics(b.footprint);
  const span = Math.max(w, d);

  const fam = isLandmark ? FAMILIES[0] : FAMILIES[Math.floor(hash(index, 3) * FAMILIES.length)];
  const color = isLandmark ? 0xdcc487 : fam.colors[Math.floor(hash(index, 7) * fam.colors.length)];
  const mat = new THREE.MeshStandardMaterial({
    map: facadeTexture().clone(),
    color,
    roughness: fam.roughness,
    metalness: fam.metalness,
    emissive: color,
    emissiveIntensity: fam.emissive,
  });
  // Tile the facade: ~1 texture tile per storey vertically, a couple across.
  mat.map.needsUpdate = true;
  mat.map.repeat.set(Math.max(1, Math.round(span / 12)), Math.max(2, Math.round(H / 24)));

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6c7075, roughness: 0.85 });
  const base = scaledPoints(b.footprint, 1, cx, cz);

  if (H > 95 || isLandmark) {
    // Tall tower: two setbacks + a slender tapered crown.
    group.add(tierMesh(base, 0, H * 0.6, mat));
    group.add(tierMesh(scaledPoints(b.footprint, 0.8, cx, cz), H * 0.6, H * 0.85, mat));
    group.add(tierMesh(scaledPoints(b.footprint, 0.58, cx, cz), H * 0.85, H, mat));
    // Spire (square tapered) + antenna mast + red aircraft-warning light.
    const spireLen = THREE.MathUtils.clamp(H * 0.18, 12, 60);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(span * 0.16, spireLen, 4), mat);
    spire.rotation.y = Math.PI / 4;
    spire.position.set(cx, H + spireLen / 2, cz);
    group.add(spire);
    const mastLen = spireLen * 0.9;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, mastLen, 6), roofMat);
    mast.position.set(cx, H + spireLen + mastLen / 2, cz);
    group.add(mast);
    const redLight = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
    redLight.position.set(cx, H + spireLen + mastLen, cz);
    group.add(redLight);
    if (isLandmark) group.add(beacon(H + spireLen + mastLen));
  } else if (H > 45) {
    // Mid-rise: a single setback + rooftop mechanical penthouse.
    group.add(tierMesh(base, 0, H * 0.9, mat));
    group.add(tierMesh(scaledPoints(b.footprint, 0.82, cx, cz), H * 0.9, H, mat));
    const box = new THREE.Mesh(new THREE.BoxGeometry(span * 0.4, 6, span * 0.34), roofMat);
    box.position.set(cx, H + 3, cz);
    group.add(box);
    // A rooftop antenna on some.
    if (hash(index, 11) > 0.6) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 16, 6), roofMat);
      a.position.set(cx, H + 8 + 8, cz);
      group.add(a);
    }
  } else {
    // Low-rise: flat roof + parapet, and sometimes a classic water tower.
    group.add(tierMesh(base, 0, H, mat));
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(span * 0.5, 2.5, span * 0.42), roofMat);
    parapet.position.set(cx, H + 1, cz);
    group.add(parapet);
    if (hash(index, 5) > 0.55) {
      const tank = new THREE.Group();
      const legMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.8 });
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.85 }));
      barrel.position.y = 9;
      tank.add(barrel);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(3.3, 2.4, 10), new THREE.MeshStandardMaterial({ color: 0x6f5238, roughness: 0.85 }));
      cap.position.y = 13.2;
      tank.add(cap);
      for (let l = 0; l < 4; l++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 4), legMat);
        const ang = (l / 4) * Math.PI * 2;
        leg.position.set(Math.cos(ang) * 2.2, 3, Math.sin(ang) * 2.2);
        tank.add(leg);
      }
      tank.position.set(cx + (hash(index, 9) - 0.5) * span * 0.3, H, cz + (hash(index, 13) - 0.5) * span * 0.3);
      group.add(tank);
    }
  }

  group.traverse((o) => { if (o.isMesh) o.name = b.name || 'building'; });
  return group;
}

// A grounded pad under each skyline so it stands on land, not floating over sea.
function groundPad(data) {
  const xs = data.buildings.flatMap((b) => b.footprint.map((p) => p[0] * SKYLINE_SCALE));
  const zs = data.buildings.flatMap((b) => b.footprint.map((p) => -p[1] * SKYLINE_SCALE));
  const pad = 220;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
  const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a6f64, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((minX + maxX) / 2, -0.4, (minZ + maxZ) / 2);
  return mesh;
}

export function buildSkyline(data, worldZ, worldX = 0) {
  const group = new THREE.Group();
  const sorted = [...data.buildings].sort((a, b) => b.height - a.height);
  const landmarkNames = new Set(sorted.slice(0, 3).map((b) => b.name).filter(Boolean));

  group.add(groundPad(data));
  data.buildings.forEach((b, i) => {
    const isLandmark = b.name && landmarkNames.has(b.name);
    group.add(buildOneBuilding(b, i, isLandmark));
  });

  group.position.set(worldX, 0, worldZ);
  return group;
}

// Landmarks sit at their footprint origin, roughly under the flight path;
// offset each skyline sideways so the plane flies PAST the city (sightseeing)
// rather than through the tallest tower.
const LONDON_WORLD_X = -420;
const NYC_WORLD_X = 450;

export function buildLondonSkyline(londonData) {
  return buildSkyline(londonData, LONDON_WORLD_Z, LONDON_WORLD_X);
}

export function buildNycSkyline(nycData) {
  return buildSkyline(nycData, NYC_WORLD_Z, NYC_WORLD_X);
}
