// Waterworld — the drowned dock, built picoCAD-style: chunky low-poly
// primitives, flat shading, PICO-8 palette, nothing smooth that could be
// crunchy instead. All geometry is generated; there are no asset files.

import * as THREE from '../../../trees/vendor/three.module.min.js';

// The PICO-8 palette, the whole aesthetic contract.
export const P8 = {
  black: 0x000000, navy: 0x1d2b53, plum: 0x7e2553, green: 0x008751,
  brown: 0xab5236, dusk: 0x5f574f, grey: 0xc2c3c7, white: 0xfff1e8,
  red: 0xff004d, orange: 0xffa300, yellow: 0xffec27, lime: 0x00e436,
  blue: 0x29adff, mauve: 0x83769c, pink: 0xff77a8, peach: 0xffccaa,
};

const _mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!_mats.has(key)) {
    _mats.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
  }
  return _mats.get(key);
}

export function box(parent, w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function cyl(parent, rt, rb, h, color, x = 0, y = 0, z = 0, seg = 6) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Neon treatment: darken the faces to near-silhouette and trace every
// hard edge with an additive glowing line. Structures become mysterious
// shapes drawn in light; the particles do the rest of the talking.
const _lineMats = new Map();
function lineMat(color) {
  if (!_lineMats.has(color)) {
    _lineMats.set(color, new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
  }
  return _lineMats.get(color);
}
const _darkMats = new Map();
function darkMat(srcColor) {
  const c = new THREE.Color(srcColor).multiplyScalar(0.22).getHex();
  if (!_darkMats.has(c)) {
    _darkMats.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  }
  return _darkMats.get(c);
}

export function neonize(root, edgeColor, { keepFaces = false } = {}) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noNeon || o.isLineSegments) return;
    if (!keepFaces && o.material && o.material.color) {
      o.material = darkMat(o.material.color.getHex());
    }
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(o.geometry, 20), lineMat(edgeColor));
    edges.userData.noNeon = true;
    o.add(edges);
  });
  return root;
}

// Chunk a geometry: snap vertices to a coarse grid so even curved
// primitives read as hand-placed picoCAD verts.
export function crunch(geo, step = 0.5) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      Math.round(pos.getX(i) / step) * step,
      Math.round(pos.getY(i) / step) * step,
      Math.round(pos.getZ(i) / step) * step);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- the sub
// The captain's boat deserves the detail budget: riveted plating,
// glowing portholes, proper red/green running lights, dive planes and a
// rudder that really deflect, twin counter-rotating props, a blinking
// masthead beacon and a nameplate. Procedural greebles — every hull is
// subtly its own.
function nameplateTexture(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2b53';
  g.fillRect(0, 0, 128, 32);
  g.strokeStyle = '#ffec27'; g.lineWidth = 3;
  g.strokeRect(2, 2, 124, 28);
  g.fillStyle = '#ffec27';
  g.font = 'bold 17px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 17);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function makeSub() {
  const g = new THREE.Group();
  // hull: main pressure vessel, tapered nose, keel strake
  const hull = box(g, 3.6, 1.6, 1.8, P8.orange);
  hull.name = 'hull';
  box(g, 1.2, 1.3, 1.5, P8.orange, 2.1, 0, 0);           // fore section
  box(g, 0.9, 0.95, 1.05, P8.yellow, 2.8, 0, 0);         // nose cap
  box(g, 0.45, 0.5, 0.55, P8.orange, 3.35, 0, 0);        // bow tip
  box(g, 3.4, 0.35, 0.5, P8.brown, 0.1, -0.95, 0);       // keel
  box(g, 1.1, 1.0, 1.5, P8.orange, -2.0, 0, 0);          // stern taper
  // conning tower with glowing bridge windows and rail
  box(g, 1.5, 1.05, 1.05, P8.yellow, -0.2, 1.25, 0);
  box(g, 0.9, 0.35, 0.9, P8.orange, -0.2, 1.9, 0);
  const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.95),
    mat(P8.blue, { emissive: 0x1155aa }));
  bridgeGlass.position.set(0.45, 1.3, 0);
  g.add(bridgeGlass);
  for (const zz of [-0.45, 0.45]) {                       // tower rail
    box(g, 1.3, 0.06, 0.06, P8.grey, -0.2, 2.15, zz);
  }
  // periscope + antenna + masthead beacon (blinks, wired by game)
  box(g, 0.12, 0.9, 0.12, P8.grey, 0.15, 2.55, 0);
  box(g, 0.3, 0.1, 0.1, P8.grey, 0.28, 2.9, 0);
  box(g, 0.06, 1.1, 0.06, P8.grey, -0.55, 2.6, 0);
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18),
    mat(P8.yellow, { emissive: 0xaa8800 }));
  beacon.position.set(-0.55, 3.2, 0);
  g.add(beacon);
  g.userData.beacon = beacon;
  // running lights, the real convention: green starboard, red port
  const stbd = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14),
    mat(P8.lime, { emissive: 0x007722 }));
  stbd.position.set(1.2, 0.5, -0.98);
  const port = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14),
    mat(P8.red, { emissive: 0x770011 }));
  port.position.set(1.2, 0.5, 0.98);
  g.add(stbd, port);
  // glowing portholes down both flanks
  for (let i = 0; i < 4; i++) {
    for (const zz of [0.92, -0.92]) {
      const ph = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.08),
        mat(P8.blue, { emissive: 0x0d4488 }));
      ph.position.set(1.6 - i * 1.0, 0.15, zz);
      g.add(ph);
    }
  }
  // headlamp housing on the nose
  box(g, 0.3, 0.45, 0.7, P8.dusk, 3.0, 0.45, 0);
  // dive planes (fore) + stern planes: animated with pitch
  const planes = new THREE.Group();
  const pf1 = box(planes, 0.9, 0.1, 1.6, P8.brown, 2.0, -0.2, 0);
  planes.userData = {};
  g.add(planes);
  const sternPlanes = new THREE.Group();
  box(sternPlanes, 1.0, 0.12, 3.0, P8.brown, 0, 0, 0);
  box(sternPlanes, 0.5, 0.1, 0.5, P8.yellow, 0, 0, 1.55);   // wingtips
  box(sternPlanes, 0.5, 0.1, 0.5, P8.yellow, 0, 0, -1.55);
  sternPlanes.position.set(-1.5, 0.15, 0);
  g.add(sternPlanes);
  g.userData.planes = sternPlanes;
  g.userData.forePlanes = planes;
  // rudder: animated with the helm
  const rudder = new THREE.Group();
  box(rudder, 0.9, 1.9, 0.14, P8.brown, -0.35, 0.35, 0);
  box(rudder, 0.4, 0.4, 0.1, P8.yellow, -0.6, 1.2, 0);
  rudder.position.set(-2.4, 0.3, 0);
  g.add(rudder);
  g.userData.rudder = rudder;
  // twin counter-rotating props in a ring guard
  const mkProp = (z) => {
    const p = new THREE.Group();
    p.position.set(-2.65, -0.1, z);
    const b1 = box(p, 0.1, 1.1, 0.3, P8.grey); b1.rotation.x = 0.5;
    const b2 = box(p, 0.1, 0.3, 1.1, P8.grey); b2.rotation.x = 0.5;
    g.add(p);
    return p;
  };
  g.userData.prop = mkProp(0.45);
  g.userData.prop2 = mkProp(-0.45);
  // nameplate, both sides
  for (const [zz, ry] of [[0.95, 0], [-0.95, Math.PI]]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4),
      new THREE.MeshBasicMaterial({ map: nameplateTexture('🐥 GC-01'), transparent: false }));
    plate.position.set(-0.6, 0.55, zz + (zz > 0 ? 0.001 : -0.001));
    plate.rotation.y = ry;
    plate.userData.noNeon = true;
    g.add(plate);
  }
  // procedural greebling: rivet strips, patch plates, weld seams —
  // no two boats quite alike
  for (let i = 0; i < 26; i++) {
    const s = 0.08 + Math.random() * 0.1;
    const r = box(g, s, s, 0.06,
      Math.random() > 0.3 ? P8.brown : P8.dusk,
      -1.6 + Math.random() * 3.4,
      -0.6 + Math.random() * 1.2,
      (Math.random() > 0.5 ? 0.91 : -0.91));
    r.userData.noNeon = true;
  }
  for (let i = 0; i < 5; i++) {                           // patch plates
    box(g, 0.5 + Math.random() * 0.4, 0.4 + Math.random() * 0.3, 0.05,
      Math.random() > 0.5 ? P8.brown : P8.orange,
      -1.5 + Math.random() * 3, -0.4 + Math.random() * 0.9,
      Math.random() > 0.5 ? 0.93 : -0.93);
  }
  return g;
}

// A curious Thames seal — pure delight, zero threat.
export function makeSeal() {
  const g = new THREE.Group();
  box(g, 1.8, 0.9, 0.9, P8.dusk, 0, 0, 0);               // body
  box(g, 0.9, 0.7, 0.7, P8.dusk, 1.2, 0.15, 0);          // chest
  box(g, 0.65, 0.6, 0.6, P8.grey, 1.85, 0.3, 0);         // head
  box(g, 0.2, 0.2, 0.5, P8.grey, 2.2, 0.15, 0);          // muzzle
  box(g, 0.1, 0.1, 0.1, P8.black, 2.35, 0.25, 0);        // nose
  box(g, 0.12, 0.12, 0.12, P8.black, 2.0, 0.45, 0.22);   // eyes
  box(g, 0.12, 0.12, 0.12, P8.black, 2.0, 0.45, -0.22);
  box(g, 0.5, 0.1, 0.7, P8.grey, 0.6, -0.4, 0.5).rotation.z = 0.4;   // flippers
  box(g, 0.5, 0.1, 0.7, P8.grey, 0.6, -0.4, -0.5).rotation.z = 0.4;
  const tail = box(g, 0.7, 0.5, 0.8, P8.dusk, -1.1, 0.05, 0);
  box(g, 0.4, 0.15, 1.1, P8.grey, -1.5, 0.05, 0);        // tail fluke
  g.userData.tail = tail;
  return g;
}

// The Glitch Canary itself. 🐥
export function makeDuck() {
  const g = new THREE.Group();
  box(g, 1.1, 0.8, 0.9, P8.yellow, 0, 0, 0);             // body
  box(g, 0.6, 0.6, 0.6, P8.yellow, 0.5, 0.6, 0);         // head
  box(g, 0.35, 0.18, 0.3, P8.orange, 0.92, 0.5, 0);      // beak
  box(g, 0.1, 0.1, 0.1, P8.black, 0.66, 0.75, 0.18);     // eyes
  box(g, 0.1, 0.1, 0.1, P8.black, 0.66, 0.75, -0.18);
  box(g, 0.5, 0.3, 0.1, P8.orange, -0.45, 0.15, 0).rotation.z = 0.5;  // tail tuft
  return g;
}

// ---------------------------------------------------------------- fauna
export function makeEelHead() {
  const g = new THREE.Group();
  const head = new THREE.Mesh(crunch(new THREE.ConeGeometry(0.8, 2.2, 5), 0.3), mat(P8.green));
  head.rotation.z = -Math.PI / 2;
  g.add(head);
  // sharp teeth: a ring of tiny white cones round the mouth
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), mat(P8.white));
    const a = (i / 5) * Math.PI * 2;
    t.position.set(1.0, Math.cos(a) * 0.45, Math.sin(a) * 0.45);
    t.rotation.z = Math.PI / 2;
    g.add(t);
  }
  box(g, 0.3, 0.3, 0.3, P8.red, -0.2, 0.45, 0.35);   // eye
  box(g, 0.3, 0.3, 0.3, P8.red, -0.2, 0.45, -0.35);  // eye
  return g;
}

export function makeEelSegment(i) {
  const s = 0.75 - i * 0.05;
  return new THREE.Mesh(new THREE.BoxGeometry(1.1, s * 1.4, s * 1.4),
    mat(i % 2 ? P8.green : P8.lime));
}

export function makeFatberg(radius = 3) {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.72 + Math.random() * 0.55;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.85, pos.getZ(i) * k);
  }
  crunch(geo, 0.4);
  const m = new THREE.Mesh(geo, mat(P8.peach));
  // horrible sweetcorn-yellow lumps, the documented fatberg garnish
  for (let i = 0; i < 6; i++) {
    const lump = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(P8.yellow));
    lump.position.setFromSphericalCoords(radius * 0.85,
      Math.random() * Math.PI, Math.random() * Math.PI * 2);
    m.add(lump);
  }
  return m;
}

export function makeMine() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(crunch(new THREE.IcosahedronGeometry(1.1, 0), 0.3), mat(P8.dusk));
  g.add(body);
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 4), mat(P8.grey));
    const v = new THREE.Vector3().setFromSphericalCoords(1.25,
      Math.acos(1 - 2 * ((i + 0.5) / 8)), i * 2.39996);
    s.position.copy(v);
    s.lookAt(v.clone().multiplyScalar(2));
    s.rotateX(Math.PI / 2);
    g.add(s);
  }
  return g;
}

// Salvage markers: one chunky mesh per artifact family.
export function makeSalvageMesh(type) {
  const g = new THREE.Group();
  switch (type) {
    case 'clay_pipe': cyl(g, 0.1, 0.1, 1.2, P8.white, 0, 0.1, 0).rotation.z = 1.2; break;
    case 'green_bottle': cyl(g, 0.25, 0.35, 1.0, P8.lime, 0, 0.5, 0); break;
    case 'sugar_barrel': cyl(g, 0.7, 0.7, 1.4, P8.brown, 0, 0.7, 0, 8); break;
    case 'cannonball': g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(P8.dusk))); break;
    case 'roman_coin': cyl(g, 0.5, 0.5, 0.12, P8.yellow, 0, 0.2, 0, 8).rotation.x = 1.2; break;
    case 'whale_bone': { box(g, 2.2, 0.3, 0.3, P8.white, 0, 0.2, 0).rotation.y = 0.5;
      box(g, 0.3, 0.8, 0.3, P8.white, 0.9, 0.3, 0.4); break; }
    case 'ships_bell': cyl(g, 0.45, 0.7, 0.9, P8.yellow, 0, 0.5, 0, 8); break;
    case 'tea_chest': box(g, 1.0, 0.8, 1.0, P8.brown, 0, 0.4, 0); break;
    case 'figurehead': { box(g, 0.5, 1.6, 0.5, P8.peach, 0, 0.8, 0);
      box(g, 0.6, 0.5, 0.6, P8.yellow, 0, 1.7, 0); break; }
    case 'anchor_chain': { box(g, 0.3, 1.5, 0.3, P8.dusk, 0, 0.7, 0);
      box(g, 1.4, 0.3, 0.3, P8.dusk, 0, 0.2, 0); break; }
    case 'fatberg_relic': g.add(makeFatberg(0.7)); break;
    case 'captains_chest': { box(g, 1.6, 0.9, 1.0, P8.brown, 0, 0.45, 0);
      box(g, 1.6, 0.3, 1.0, P8.yellow, 0, 1.0, 0);
      box(g, 0.3, 0.5, 0.2, P8.yellow, 0, 0.7, 0.45); break; }
    default: box(g, 0.6, 0.6, 0.6, P8.grey, 0, 0.3, 0);
  }
  return g;
}

export function makeQuestMesh() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(crunch(new THREE.OctahedronGeometry(0.7, 0), 0.2), mat(P8.pink, { emissive: 0x550022 }));
  m.position.y = 0.7;
  g.add(m);
  g.userData.spin = m;
  return g;
}

// ---------------------------------------------------------------- terrain

// Basin bounds. Shallow shelf west, deep basin east, culverts in the
// north wall. Water surface is y = 0.
export const BOUNDS = { minX: -120, maxX: 120, minZ: -80, maxZ: 80, surface: -1.6 };
export const SHELF_Y = -34, DEEP_Y = -64;

export function floorYAt(x, z) {
  let y;
  if (x < 20) y = SHELF_Y;
  else if (x > 55) y = DEEP_Y;
  else y = SHELF_Y + (x - 20) / 35 * (DEEP_Y - SHELF_Y);   // the slope
  // gentle chunky ripple so the floor is not a plane
  y += Math.round((Math.sin(x * 0.11) + Math.cos(z * 0.13)) * 2) * 0.6;
  return y;
}

function makeFloor(scene) {
  const geo = new THREE.PlaneGeometry(
    BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ, 48, 32);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const silt = new THREE.Color(P8.brown), deep = new THREE.Color(P8.navy),
    weed = new THREE.Color(P8.green);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, floorYAt(x, z) - 0.4);
    const t = Math.min(1, Math.max(0, (x - 10) / 60));
    const c = silt.clone().lerp(deep, t).multiplyScalar(0.5);   // let the neon lead
    if (Math.sin(x * 1.7 + z * 2.3) > 0.93) c.copy(weed).multiplyScalar(0.7);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scene.add(m);
  return m;
}

function makeQuayWalls(scene) {
  const g = new THREE.Group();
  const H = 70, T = 6;
  const wall = (w, d, x, z) => {
    const b = box(g, w, H, d, P8.dusk, x, -H / 2 + 2, z);
    return b;
  };
  wall(BOUNDS.maxX - BOUNDS.minX + T * 2, T, 0, BOUNDS.minZ - T / 2);
  wall(BOUNDS.maxX - BOUNDS.minX + T * 2, T, 0, BOUNDS.maxZ + T / 2);
  wall(T, BOUNDS.maxZ - BOUNDS.minZ, BOUNDS.minX - T / 2, 0);
  wall(T, BOUNDS.maxZ - BOUNDS.minZ, BOUNDS.maxX + T / 2, 0);
  // mooring posts and rotted jetty stumps along the south quay
  for (let x = -110; x <= 110; x += 20) {
    cyl(g, 0.8, 0.9, 6, P8.brown, x, -3, BOUNDS.maxZ - 2, 6);
  }
  scene.add(g);
  return g;
}

// Culvert arches in the north wall — the tunnels the fatbergs escape from.
export function makeCulverts(scene) {
  const mouths = [];
  const xs = [-70, -30, 5];
  for (const x of xs) {
    const g = new THREE.Group();
    const y = floorYAt(x, BOUNDS.minZ) + 4;
    g.position.set(x, y, BOUNDS.minZ + 1);
    box(g, 12, 12, 4, P8.navy, 0, 2, -2);                   // arch block
    box(g, 10, 9, 6, P8.black, 0, 0.5, -1);                 // the dark hole
    cyl(g, 4.5, 4.5, 8, P8.black, 0, 0, -4, 8).rotation.x = Math.PI / 2;
    box(g, 1.5, 14, 2, P8.dusk, -6.5, 2, 0);
    box(g, 1.5, 14, 2, P8.dusk, 6.5, 2, 0);
    scene.add(g);
    mouths.push({ x, y, z: BOUNDS.minZ + 4, group: g });
  }
  return mouths;
}

function makeCrane(scene) {
  const g = new THREE.Group();
  g.position.set(60, DEEP_Y, 40);
  box(g, 4, 26, 4, P8.dusk, 0, 13, 0);
  box(g, 22, 2.5, 2.5, P8.dusk, 8, 26, 0).rotation.z = -0.12;
  box(g, 2, 6, 2, P8.brown, 18, 21, 0);   // hook block, drooping
  cyl(g, 0.4, 0.4, 14, P8.dusk, 18, 13, 0);
  g.rotation.z = 0.35;                     // toppled, half fallen
  g.rotation.y = -0.7;
  scene.add(g);
  return g;
}

function makeBarge(scene) {
  const g = new THREE.Group();
  g.position.set(-40, SHELF_Y + 1.5, 30);
  g.rotation.y = 0.8; g.rotation.z = 0.28;
  box(g, 26, 5, 9, P8.plum, 0, 2, 0);
  box(g, 24, 1.5, 7, P8.black, 0, 4.5, 0);     // open hold
  box(g, 5, 4, 8, P8.dusk, -9, 6, 0);          // wheelhouse
  box(g, 1.2, 6, 1.2, P8.brown, 6, 7, 2);      // broken mast
  scene.add(g);
  return g;
}

function makeWarehouse(scene) {
  const g = new THREE.Group();
  g.position.set(85, DEEP_Y, -30);
  // roofless brick shell, tumbled columns
  box(g, 30, 14, 2, P8.plum, 0, 7, -10);
  box(g, 30, 9, 2, P8.plum, 0, 4.5, 12);
  box(g, 2, 12, 22, P8.plum, -15, 6, 1);
  for (let i = 0; i < 4; i++) {
    const c = cyl(g, 1, 1.2, 10, P8.dusk, -8 + i * 6, 1.5, 1, 6);
    c.rotation.z = 1.35; c.rotation.y = i;
  }
  scene.add(g);
  return g;
}

export function makeDivingBell(scene) {
  const g = new THREE.Group();
  g.position.set(-95, -14, 0);
  const dome = new THREE.Mesh(
    crunch(new THREE.SphereGeometry(4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0.5),
    mat(P8.yellow));
  g.add(dome);
  cyl(g, 4.4, 4.6, 1.2, P8.orange, 0, -0.4, 0, 8);
  box(g, 0.6, 12, 0.6, P8.dusk, 0, 8, 0);           // chain to the surface
  const lamp = new THREE.PointLight(0xffec27, 25, 40);
  lamp.position.set(0, -1, 0);
  g.add(lamp);
  // beacon: a bright ring you can see across the basin
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.25, 4, 10), mat(P8.yellow, { emissive: 0x886600 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -1;
  g.add(ring);
  g.userData.ring = ring;
  scene.add(g);
  return g;
}

function makeCrates(scene) {
  const g = new THREE.Group();
  const spots = [[-70, 15], [-60, -40], [10, 55], [-15, -20], [30, 10]];
  for (const [x, z] of spots) {
    const y = floorYAt(x, z);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = 1.5 + Math.random();
      box(g, s, s, s, i % 2 ? P8.brown : P8.dusk,
        x + (Math.random() - 0.5) * 4, y + s / 2, z + (Math.random() - 0.5) * 4)
        .rotation.y = Math.random();
    }
  }
  scene.add(g);
  return g;
}

// Kelp/weed: thin green boxes waving — cheap, sells "underwater" hard.
export function makeWeeds(scene, count = 110) {
  const g = new THREE.Group();
  const stalks = [];
  for (let i = 0; i < count; i++) {
    const x = BOUNDS.minX + Math.random() * (BOUNDS.maxX - BOUNDS.minX);
    const z = BOUNDS.minZ + Math.random() * (BOUNDS.maxZ - BOUNDS.minZ);
    const h = 3 + Math.random() * 8;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.4),
      mat(Math.random() > 0.5 ? P8.green : P8.lime,
        { emissive: Math.random() > 0.5 ? 0x0a3d22 : 0x123d0a }));
    s.position.set(x, floorYAt(x, z) + h / 2, z);
    g.add(s);
    s.userData.phase = Math.random() * Math.PI * 2;
    stalks.push(s);
  }
  scene.add(g);
  return stalks;
}

// The whole static set. Returns collider list for the physics step.
export function buildDock(scene) {
  makeFloor(scene);
  const quay = makeQuayWalls(scene);
  const culverts = makeCulverts(scene);
  const crane = makeCrane(scene);
  const barge = makeBarge(scene);
  const warehouse = makeWarehouse(scene);
  const bell = makeDivingBell(scene);
  const crates = makeCrates(scene);
  const weeds = makeWeeds(scene);
  // the neon pass: each structure family gets its own signature glow
  neonize(quay, 0x1d6f8f);
  for (const m of culverts) neonize(m.group, 0x00e436);
  neonize(crane, 0xffa300);
  neonize(barge, 0xff77a8);
  neonize(warehouse, 0x83769c);
  neonize(crates, 0x8f6a30);
  neonize(bell, 0xffec27, { keepFaces: true });
  // sphere colliders for the big set pieces (cheap, forgiving)
  const colliders = [
    { x: 60, y: DEEP_Y + 8, z: 40, r: 9 },       // crane base
    { x: -40, y: SHELF_Y + 4, z: 30, r: 10 },    // barge
    { x: 85, y: DEEP_Y + 6, z: -30, r: 11 },     // warehouse
  ];
  return { culverts, crane, barge, warehouse, bell, weeds, colliders };
}

// ---------------------------------------------------------------- particles

export function makeParticleCloud(count, color, size, spread) {
  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) posArr[i] = (Math.random() - 0.5) * spread;
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const m = new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, transparent: true, opacity: 0.8, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  return m;
}

// The ghost whale: no mesh at all — a drifting constellation of pale
// particles in a whale-shaped envelope. 3DGS on a PICO-8 budget.
export function makeGhostWhale() {
  const count = 420;
  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // body: ellipsoid 14 long; tail: tapering cone behind; fluke: flat fan
    const t = Math.random();
    let x, y, z;
    if (t < 0.7) {           // body
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u) * (0.9 + Math.random() * 0.2);
      const a = Math.random() * Math.PI * 2;
      x = u * 7; y = Math.cos(a) * r * 2.4; z = Math.sin(a) * r * 2.0;
    } else if (t < 0.92) {   // tail stock
      const k = Math.random();
      x = -7 - k * 5; y = (Math.random() - 0.5) * (2 - k * 1.6); z = (Math.random() - 0.5) * (2 - k * 1.6);
    } else {                 // fluke
      const a = (Math.random() - 0.5) * 2.2;
      x = -12.5 - Math.random(); y = (Math.random() - 0.5) * 0.6; z = a * 3;
    }
    posArr[i * 3] = x; posArr[i * 3 + 1] = y; posArr[i * 3 + 2] = z;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const whale = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xc8f0ff, size: 0.55, transparent: true, opacity: 0.0,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  whale.userData.base = posArr.slice();
  return whale;
}
