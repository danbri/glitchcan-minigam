// Recognisable procedural models of the specific named landmarks present in
// the real OSM data (The Shard, the Gherkin, the Cheesegrater, Empire State,
// 432 Park Ave). Built from primitives — no external model downloads — so the
// key buildings of each city are actually identifiable, not generic towers.
// Each builder is positioned at the building's real footprint centroid and
// sized to its real height, so they sit correctly within the skyline.

import * as THREE from '../vendor/three.module.min.js';

const glass = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.14, metalness: 0.55, emissive: color, emissiveIntensity: 0.24 });
const stone = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, emissive: color, emissiveIntensity: 0.18 });

// The Shard — a tapering glass spire of 8 facets rising to a near-point.
function theShard(cx, cz, span, H) {
  const g = new THREE.Group();
  const r = Math.max(span * 0.5, 9);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.04, r, H, 8, 1), glass(0x9fc8e6));
  body.rotation.y = Math.PI / 8;
  body.position.set(cx, H / 2, cz);
  g.add(body);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 6, 5), glass(0xd6ecff));
  tip.position.set(cx, H, cz);
  g.add(tip);
  return g;
}

// 30 St Mary Axe (the Gherkin) — a bullet/ovoid tower that bulges then tapers
// to a rounded glass cap.
function theGherkin(cx, cz, span, H) {
  const g = new THREE.Group();
  const rMax = Math.max(span * 0.5, 10);
  const pts = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const r = rMax * (0.42 + 0.58 * Math.pow(Math.sin(Math.PI * Math.min(u * 1.02, 1)), 0.7));
    pts.push(new THREE.Vector2(Math.max(0.5, r), u * H));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 22), glass(0x6fb090));
  body.position.set(cx, 0, cz);
  g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(rMax * 0.14, 10, 8), glass(0xcdeadd));
  cap.position.set(cx, H, cz);
  g.add(cap);
  return g;
}

// The Leadenhall Building (the Cheesegrater) — a wedge that slopes back from a
// vertical front face.
function theCheesegrater(cx, cz, span, H) {
  const g = new THREE.Group();
  const w = Math.max(span, 16), d = w * 0.68;
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(d / 2, H);            // vertical front
  shape.lineTo(-d / 2, H * 0.42);    // sloped back
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2);
  const m = new THREE.Mesh(geo, glass(0x9fb8c6));
  m.position.set(cx, 0, cz);
  g.add(m);
  return g;
}

// Empire State Building — limestone art-deco setbacks + a mooring-mast spire.
function empireState(cx, cz, span, H) {
  const g = new THREE.Group();
  const mat = stone(0xcabfa4);
  const base = Math.max(span, 20);
  const tops = [0.16, 0.62, 0.9];
  const scales = [1.15, 0.7, 0.42];
  let from = 0;
  for (let i = 0; i < 3; i++) {
    const to = tops[i] * H;
    const s = scales[i] * base;
    const box = new THREE.Mesh(new THREE.BoxGeometry(s, to - from, s * 0.78), mat);
    box.position.set(cx, (from + to) / 2, cz);
    g.add(box);
    from = to;
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(base * 0.05, base * 0.1, H * 0.09, 10), mat);
  mast.position.set(cx, H * 0.9 + H * 0.045, cz);
  g.add(mast);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, H * 0.06, 6), mat);
  antenna.position.set(cx, H * 0.99 + H * 0.03, cz);
  g.add(antenna);
  return g;
}

// 432 Park Avenue — an ultra-slender square tower with a big square-window grid.
function slenderSquare(cx, cz, span, H) {
  const g = new THREE.Group();
  const s = THREE.MathUtils.clamp(span * 0.8, 12, H * 0.11);
  const mat = new THREE.MeshStandardMaterial({ color: 0xe6e2d8, roughness: 0.45, metalness: 0.15, emissive: 0xe6e2d8, emissiveIntensity: 0.2 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(s, H, s), mat);
  box.position.set(cx, H / 2, cz);
  g.add(box);
  // Punched-window grid: thin dark frames at regular intervals on all faces.
  const frameMat = new THREE.MeshBasicMaterial({ color: 0x3a4048 });
  const floors = Math.round(H / 22);
  for (let f = 1; f < floors; f++) {
    const y = (f / floors) * H;
    const ring = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, 1.2, s * 1.02), frameMat);
    ring.position.set(cx, y, cz);
    g.add(ring);
  }
  return g;
}

const BUILDERS = {
  'The Shard': theShard,
  '30 St Mary Axe': theGherkin,
  'The Leadenhall Building': theCheesegrater,
  'Empire State Building': empireState,
  '432 Park Avenue': slenderSquare,
};

export function landmarkModel(name, cx, cz, span, H) {
  const fn = name && BUILDERS[name];
  return fn ? fn(cx, cz, span, H) : null;
}
