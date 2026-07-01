// Extrudes the real OSM building footprints (data/buildings-*.json, fetched
// by tools/fetch-buildings.mjs) into a toy skyline at each end of the route.
// Colours are playful rather than realistic — this is for a toddler, not an
// architecture viz — but every footprint and height comes from real data.

import * as THREE from '../vendor/three.module.min.js';
import { LONDON_WORLD_Z, NYC_WORLD_Z } from './ua17-route.js';

const PALETTE = [0xffe3b3, 0xffc6d9, 0xb3e5ff, 0xc9f2d0, 0xe0c9ff, 0xfff3b0];

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
// own centre so it reads as "a skyline" sitting beside the flight path
// instead of a city-sized field the path cannot help but fly through.
const SKYLINE_SCALE = 0.25;

function buildingMesh(b, index, isLandmark) {
  const shape = new THREE.Shape();
  b.footprint.forEach(([x, z], i) => {
    const sx = x * SKYLINE_SCALE, sz = -z * SKYLINE_SCALE;
    if (i === 0) shape.moveTo(sx, sz); else shape.lineTo(sx, sz);
  });
  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const color = isLandmark ? 0xffd27a : PALETTE[index % PALETTE.length];
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: isLandmark ? 0.4 : 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = b.name || 'building';
  return mesh;
}

export function buildSkyline(data, worldZ, worldX = 0) {
  const group = new THREE.Group();
  const sorted = [...data.buildings].sort((a, b) => b.height - a.height);
  const landmarkNames = new Set(sorted.slice(0, 3).map((b) => b.name));

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
