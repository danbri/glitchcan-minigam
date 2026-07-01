// Extrudes the real OSM building footprints (data/buildings-*.json, fetched
// by tools/fetch-buildings.mjs) into a skyline at each end of the route.
// Every footprint and height comes from real data; the glass-window texture,
// realistic material tones and landmark tapering are stylised on top of it.

import * as THREE from '../vendor/three.module.min.js';
import { LONDON_WORLD_Z, NYC_WORLD_Z } from './ua17-route.js';

// Muted glass/stone tones instead of candy pastels — reads as "city", not "toy blocks".
const PALETTE = [0x8fa3ad, 0x9aa7ad, 0xb7ada0, 0x8a97a6, 0xa3a89c, 0x9fadb8, 0x87909c];

let sharedWindowTexture = null;
function windowTexture() {
  if (sharedWindowTexture) return sharedWindowTexture;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  // A LIGHT base with thin dark mullion lines (rather than dark glass with
  // light windows) keeps the texture's average brightness high — at
  // real-world viewing distance a building is only a few pixels across, so
  // a dark-average texture minifies down to a near-black silhouette
  // regardless of the material's own colour tint.
  ctx.fillStyle = '#e4e8ea';
  ctx.fillRect(0, 0, c.width, c.height);
  const cols = 4, rows = 9;
  const padX = 6, padY = 8;
  const cw = (c.width - padX * (cols + 1)) / cols;
  const ch = (c.height - padY * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = Math.random() < 0.15;
      ctx.fillStyle = lit ? 'rgba(255,224,150,0.95)' : `rgba(120,140,150,${0.3 + Math.random() * 0.25})`;
      const x = padX + col * (cw + padX);
      const y = padY + r * (ch + padY);
      ctx.fillRect(x, y, cw, ch);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedWindowTexture = tex;
  return tex;
}

function beacon(height) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.set(26, 26, 1);
  sprite.position.y = height + 10;
  return sprite;
}

// The real OSM footprints span ~1.5-2.5km across (a whole downtown), which
// dwarfs our ~7000-unit stylised route. Compress the whole layout toward its
// own centre so it reads as a dense skyline sitting beside the flight path
// instead of a city-sized field the path cannot help but fly through.
const SKYLINE_SCALE = 0.32;

// Pinches a building's cross-section in toward its own centreline as it
// rises — turns a flat-topped box into a tapered spire, which is what makes
// a landmark tower (Shard/Empire State-style) actually read as a landmark
// instead of just "the biggest box".
function taperTop(geo, height, topScale) {
  const pos = geo.attributes.position;
  let cx = 0, cz = 0;
  for (let i = 0; i < pos.count; i++) { cx += pos.getX(i); cz += pos.getZ(i); }
  cx /= pos.count; cz /= pos.count;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const f = THREE.MathUtils.lerp(1, topScale, THREE.MathUtils.clamp(y / height, 0, 1));
    pos.setX(i, cx + (pos.getX(i) - cx) * f);
    pos.setZ(i, cz + (pos.getZ(i) - cz) * f);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function buildingMesh(b, index, isLandmark) {
  const shape = new THREE.Shape();
  b.footprint.forEach(([x, z], i) => {
    const sx = x * SKYLINE_SCALE, sz = -z * SKYLINE_SCALE;
    if (i === 0) shape.moveTo(sx, sz); else shape.lineTo(sx, sz);
  });
  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false, steps: isLandmark ? 6 : 1 });
  geo.rotateX(-Math.PI / 2);
  if (isLandmark) taperTop(geo, b.height, 0.42);

  const color = isLandmark ? 0xd9b877 : PALETTE[index % PALETTE.length];
  const mat = new THREE.MeshStandardMaterial({
    map: windowTexture(),
    color,
    roughness: isLandmark ? 0.3 : 0.65,
    // Low metalness + a mild self-colour emissive: at low metalness/high
    // gloss a building on the shadow side of the sun went near-black from a
    // lot of viewing angles (reads as a broken silhouette, not "beautiful").
    // The emissive tint keeps its colour/window texture legible everywhere.
    metalness: isLandmark ? 0.3 : 0.05,
    emissive: color,
    emissiveIntensity: isLandmark ? 0.32 : 0.28,
  });
  mat.map.repeat.set(2, Math.max(2, Math.round(b.height / 40)));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = b.name || 'building';
  return mesh;
}

// A grounded pad under each skyline — otherwise the towers read as blocks
// floating disconnected over open ocean rather than a city standing on land.
function groundPad(data) {
  const xs = data.buildings.flatMap((b) => b.footprint.map((p) => p[0] * SKYLINE_SCALE));
  const zs = data.buildings.flatMap((b) => b.footprint.map((p) => -p[1] * SKYLINE_SCALE));
  const pad = 220;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
  const w = maxX - minX, d = maxZ - minZ;
  const geo = new THREE.PlaneGeometry(w, d, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b6f66, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((minX + maxX) / 2, -0.4, (minZ + maxZ) / 2);
  return mesh;
}

export function buildSkyline(data, worldZ, worldX = 0) {
  const group = new THREE.Group();
  const sorted = [...data.buildings].sort((a, b) => b.height - a.height);
  const landmarkNames = new Set(sorted.slice(0, 3).map((b) => b.name));

  group.add(groundPad(data));

  data.buildings.forEach((b, i) => {
    const isLandmark = landmarkNames.has(b.name) && b.name;
    const mesh = buildingMesh(b, i, isLandmark);
    group.add(mesh);
    if (isLandmark) mesh.add(beacon(b.height));
  });

  group.position.z = worldZ;
  group.position.x = worldX;
  return group;
}

// Landmark buildings tend to sit right at the origin of their own footprint
// data, which is also roughly where the flight path passes overhead during
// climb-out/approach. Offset each skyline sideways so the plane flies PAST
// the skyline (a nice sightseeing view) rather than straight through the
// tallest tower.
const LONDON_WORLD_X = -420;
const NYC_WORLD_X = 450;

export function buildLondonSkyline(londonData) {
  return buildSkyline(londonData, LONDON_WORLD_Z, LONDON_WORLD_X);
}

export function buildNycSkyline(nycData) {
  return buildSkyline(nycData, NYC_WORLD_Z, NYC_WORLD_X);
}
