// Waterworld — the drowned dock. ART DIRECTION v2 (the picoCAD/blocky
// constraints are officially retired): smooth-shaded organic forms,
// full-resolution rendering, soft round particles, bioluminescent
// accents. All geometry is still generated — no asset files — but
// nothing is crunched, snapped or flat-shaded any more.

import * as THREE from '../../../trees/vendor/three.module.min.js';

// Named colours kept as a convenience vocabulary (no longer a constraint).
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
    _mats.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  }
  return _mats.get(key);
}

// One soft round dot, shared by every particle system — square GL points
// were half of what read as "pixelated".
let _softDot = null;
export function softDot() {
  if (_softDot) return _softDot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  _softDot = new THREE.CanvasTexture(c);
  return _softDot;
}

// Smooth primitive helpers for organic shapes.
export function ball(parent, r, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(color, opts));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function box(parent, w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function cyl(parent, rt, rb, h, color, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Signature tinting: each structure family keeps an identity via a
// faint emissive undertone rather than wireframe edges (retired with
// the blocky art). Call on a finished group.
export function tint(root, emissiveHex, strength = 1) {
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color || o.userData.noTint) return;
    const key = o.material.color.getHex();
    if (!cache.has(key)) {
      const m = o.material.clone();
      m.emissive = new THREE.Color(emissiveHex).multiplyScalar(0.18 * strength);
      cache.set(key, m);
    }
    o.material = cache.get(key);
  });
  return root;
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
  return new THREE.CanvasTexture(c);
}

export function makeSub() {
  const g = new THREE.Group();
  // hull: a proper turned torpedo body — LatheGeometry profile, smooth
  const profile = [];
  const L = 7.2;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;                              // 0 = stern, 1 = bow
    const r = 1.05 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** 0.7;
    profile.push(new THREE.Vector2(Math.max(0.02, r), (t - 0.52) * L));
  }
  const hullGeo = new THREE.LatheGeometry(profile, 28);
  hullGeo.rotateZ(-Math.PI / 2);                   // axis along +x
  const hull = new THREE.Mesh(hullGeo, mat(0xe09a3a, { emissive: 0x5a2c08 }));
  hull.name = 'hull';
  g.add(hull);
  // sail: elliptical tower with a rounded cap
  const sail = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 1.5, 20), mat(0xd9a441, { emissive: 0x633a0c }));
  sail.scale.z = 0.62;
  sail.position.set(-0.1, 1.35, 0);
  g.add(sail);
  const sailCap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 12), mat(0xd9a441, { emissive: 0x633a0c }));
  sailCap.scale.set(1, 0.45, 0.62);
  sailCap.position.set(-0.1, 2.1, 0);
  g.add(sailCap);
  const glass = ball(g, 0.34, P8.blue, 0.42, 1.5, 0, { emissive: 0x2277cc });
  glass.scale.set(0.7, 0.8, 1.1);
  // periscope, antenna, masthead beacon (blinks, wired by game)
  cyl(g, 0.05, 0.07, 1.0, P8.grey, 0.12, 2.6, 0, 10);
  cyl(g, 0.035, 0.035, 1.2, P8.grey, -0.5, 2.7, 0, 8);
  const beacon = ball(g, 0.12, P8.yellow, -0.5, 3.35, 0, { emissive: 0xaa8800 });
  g.userData.beacon = beacon;
  // running lights: green starboard, red port (the real convention)
  ball(g, 0.09, P8.lime, 1.1, 0.55, -0.85, { emissive: 0x00aa33 });
  ball(g, 0.09, P8.red, 1.1, 0.55, 0.85, { emissive: 0xaa0022 });
  // glowing portholes down both flanks, following the hull's curve
  for (let i = 0; i < 5; i++) {
    const px = 1.8 - i * 0.95;
    const pr = 0.95 * Math.sin(Math.PI * Math.min(1, 0.12 + ((px / L) + 0.52) * 0.95)) ** 0.7;
    for (const s of [1, -1]) {
      ball(g, 0.1, P8.blue, px, 0.12, s * pr, { emissive: 0x2266cc });
    }
  }
  // headlamp housing
  const lampH = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat(P8.dusk));
  lampH.scale.set(0.7, 1, 1);
  lampH.position.set(3.1, 0.35, 0);
  g.add(lampH);
  // dive planes fore + stern (animated with pitch): slim smooth foils
  const foil = (w, len) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), mat(P8.brown));
    f.scale.set(w / 2, 0.06, len / 2);
    return f;
  };
  const planes = new THREE.Group();
  const pf = foil(0.9, 3.0); planes.add(pf);
  planes.position.set(1.9, -0.15, 0);
  g.add(planes);
  const sternPlanes = new THREE.Group();
  sternPlanes.add(foil(1.0, 3.4));
  sternPlanes.position.set(-1.6, 0.1, 0);
  g.add(sternPlanes);
  g.userData.planes = sternPlanes;
  g.userData.forePlanes = planes;
  // rudder: a smooth vertical foil
  const rudder = new THREE.Group();
  const rf = foil(1.0, 2.2);
  rf.rotation.x = Math.PI / 2;
  rudder.add(rf);
  rudder.position.set(-2.6, 0.35, 0);
  g.add(rudder);
  g.userData.rudder = rudder;
  // twin counter-rotating props: three curved blades each
  const mkProp = (z) => {
    const p = new THREE.Group();
    p.position.set(-3.15, -0.05, z);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6), mat(P8.grey));
      blade.scale.set(0.12, 1, 0.34);
      blade.position.y = 0;
      const holder = new THREE.Group();
      holder.rotation.x = (b / 3) * Math.PI * 2;
      blade.position.y = 0.45;
      blade.rotation.x = 0.5;
      holder.add(blade);
      p.add(holder);
    }
    ball(p, 0.14, P8.dusk, 0, 0, 0);
    g.add(p);
    return p;
  };
  g.userData.prop = mkProp(0.4);
  g.userData.prop2 = mkProp(-0.4);
  // nameplate, both sides
  for (const [zz, ry] of [[0.9, 0], [-0.9, Math.PI]]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38),
      new THREE.MeshBasicMaterial({ map: nameplateTexture('🐥 GC-01'), transparent: false }));
    plate.position.set(-0.5, 0.45, zz + (zz > 0 ? 0.02 : -0.02));
    plate.rotation.y = ry;
    plate.userData.noTint = true;
    g.add(plate);
  }
  // gentle greebling: rounded rivets and sensor bumps along the hull
  for (let i = 0; i < 18; i++) {
    const px = -2.2 + Math.random() * 4.2;
    const pr = 0.98 * Math.sin(Math.PI * Math.min(1, 0.12 + ((px / L) + 0.52) * 0.95)) ** 0.7;
    const a = (Math.random() - 0.5) * 1.6;
    ball(g, 0.05 + Math.random() * 0.05,
      Math.random() > 0.4 ? P8.brown : P8.dusk,
      px, Math.sin(a) * pr * 0.5, Math.sign(Math.random() - 0.5) * Math.cos(a) * pr);
  }
  return g;
}

// A moored boat, seen from below: dark rounded hull hanging in the
// bright ceiling. kind: 'tug' | 'narrowboat' | 'barge'.
export function makeBoatHull(kind) {
  const g = new THREE.Group();
  const spec = {
    tug: { L: 16, beam: 6, draft: 3.2, color: 0x7a2f20 },
    narrowboat: { L: 20, beam: 3.4, draft: 1.6, color: 0x1e4030 },
    barge: { L: 26, beam: 8, draft: 2.6, color: 0x24303e },
  }[kind] || { L: 18, beam: 6, draft: 2.5, color: 0x333333 };
  // bottom half-ellipsoid hull
  const hull = new THREE.Mesh(
    new THREE.SphereGeometry(1, 26, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    mat(spec.color));
  hull.scale.set(spec.L / 2, spec.draft, spec.beam / 2);
  g.add(hull);
  // keel strake, rudder, a still prop
  const keel = new THREE.Mesh(new THREE.BoxGeometry(spec.L * 0.7, 0.3, 0.35), mat(0x1a1a1a));
  keel.position.y = -spec.draft * 0.96;
  g.add(keel);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.2, spec.draft * 0.8, 1.2), mat(0x1a1a1a));
  rudder.position.set(-spec.L / 2 + 0.4, -spec.draft * 0.5, 0);
  g.add(rudder);
  ball(g, 0.5, 0x2a2a2a, -spec.L / 2 + 1.4, -spec.draft * 0.55, 0);
  // waterline shimmer: a pale band right at the surface
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.001, 1.001, 0.25, 26, 1, true),
    mat(0xd8ecf4, { emissive: 0x5a7f90 }));
  band.scale.set(spec.L / 2, 1, spec.beam / 2);
  band.position.y = 0.05;
  g.add(band);
  g.userData.spec = spec;
  return g;
}

// A dolphin — grey above, pale below, permanently mid-smile.
export function makeDolphin() {
  const g = new THREE.Group();
  const body = ball(g, 1, 0x8fa8b8, 0, 0, 0);
  body.scale.set(2.1, 0.62, 0.55);
  const belly = ball(g, 0.92, 0xdfeaf2, 0.1, -0.12, 0);
  belly.scale.set(1.9, 0.5, 0.48);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 14), mat(0x8fa8b8));
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(2.2, 0.05, 0);
  g.add(snout);
  const fin = ball(g, 0.55, 0x76909f, -0.2, 0.72, 0);   // dorsal
  fin.scale.set(0.55, 0.9, 0.12);
  fin.rotation.z = -0.5;
  for (const s of [1, -1]) {
    const fl = ball(g, 0.42, 0x76909f, 0.7, -0.3, s * 0.5);
    fl.scale.set(0.9, 0.14, 0.5);
    fl.rotation.y = s * 0.5;
  }
  const fluke = ball(g, 0.5, 0x76909f, -2.2, 0.05, 0);
  fluke.scale.set(0.5, 0.14, 1.5);
  g.userData.fluke = fluke;
  ball(g, 0.08, 0x111111, 1.55, 0.18, 0.32);
  ball(g, 0.08, 0x111111, 1.55, 0.18, -0.32);
  return g;
}

// A shark — longer, lower, and not actually interested in you.
export function makeShark() {
  const g = new THREE.Group();
  const body = ball(g, 1, 0x5c707e, 0, 0, 0);
  body.scale.set(2.7, 0.7, 0.6);
  const belly = ball(g, 0.9, 0xc4ccd2, 0.1, -0.18, 0);
  belly.scale.set(2.4, 0.5, 0.5);
  const snout = ball(g, 0.55, 0x5c707e, 2.5, 0, 0);
  snout.scale.set(1.2, 0.55, 0.7);
  const dorsal = ball(g, 0.8, 0x4a5a66, -0.1, 0.95, 0);
  dorsal.scale.set(0.7, 1.0, 0.1);
  dorsal.rotation.z = -0.35;
  for (const s of [1, -1]) {
    const p = ball(g, 0.6, 0x4a5a66, 0.9, -0.35, s * 0.7);
    p.scale.set(0.9, 0.1, 0.55);
    p.rotation.y = s * 0.6;
    p.rotation.z = s * -0.15;
  }
  const tail = new THREE.Group();
  const tUp = ball(tail, 0.7, 0x4a5a66, 0, 0.5, 0);
  tUp.scale.set(0.5, 1.1, 0.1);
  tUp.rotation.z = 0.5;
  const tDn = ball(tail, 0.45, 0x4a5a66, 0, -0.3, 0);
  tDn.scale.set(0.4, 0.7, 0.1);
  tDn.rotation.z = -0.4;
  tail.position.set(-2.8, 0, 0);
  g.add(tail);
  g.userData.tail = tail;
  ball(g, 0.09, 0x0a0a0a, 2.1, 0.15, 0.4);
  ball(g, 0.09, 0x0a0a0a, 2.1, 0.15, -0.4);
  return g;
}

// A bright little reef fish for the close-up shots the schools can't do.
export function makeReefFish(color) {
  const g = new THREE.Group();
  const body = ball(g, 0.4, color, 0, 0, 0, { emissive: new THREE.Color(color).multiplyScalar(0.25).getHex() });
  body.scale.set(1.5, 1.0, 0.4);
  const tail = ball(g, 0.28, color, -0.68, 0, 0);
  tail.scale.set(0.6, 0.9, 0.1);
  g.userData.tail = tail;
  ball(g, 0.05, 0x111111, 0.42, 0.1, 0.13);
  ball(g, 0.05, 0x111111, 0.42, 0.1, -0.13);
  return g;
}

// ---- Campaign sites -------------------------------------------------

// The Steelyard stone: a Hanseatic boundary marker, remembered ground.
export function makeSteelyard() {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 1.2, 8), mat(0x4a5568));
  plinth.position.y = 0.6;
  g.add(plinth);
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 4.2, 6), mat(0x5c6b7c, { emissive: 0x101820 }));
  stone.position.y = 3;
  g.add(stone);
  const seal = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.18, 8, 16), mat(P8.yellow, { emissive: 0x665500 }));
  seal.position.set(0, 3.6, 1.05);
  g.add(seal);
  // grave-plots: three empty hollows waiting for the bones
  g.userData.plots = [];
  for (let i = 0; i < 3; i++) {
    const plot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 10), mat(0x2a3440));
    plot.position.set(Math.cos(i * 2.1) * 3.4, 0.15, Math.sin(i * 2.1) * 3.4);
    g.add(plot);
    g.userData.plots.push(plot);
  }
  return g;
}

// A ghost's bone: a great rib, half out of the silt — if the ghosts
// are real, these are theirs; if not, the guilt is real enough.
export function makeBone() {
  const g = new THREE.Group();
  const rib = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.32, 10, 18, Math.PI * 0.85), mat(0xe8e2d4, { emissive: 0x333026 }));
  rib.rotation.z = 0.4 + Math.random() * 0.5;
  g.add(rib);
  return g;
}

// A charter fragment: torn vellum in a bottle-green glass case.
export function makeFragment() {
  const g = new THREE.Group();
  const caseM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.3), mat(0x9fdcff, { emissive: 0x28506e }));
  caseM.position.y = 0.7;
  caseM.rotation.z = (Math.random() - 0.5) * 0.6;
  g.add(caseM);
  return g;
}

// An elder eel: bigger, calmer, crowned in living light.
export function makeElderEel(tint) {
  const g = new THREE.Group();
  const head = makeEelHead();
  head.scale.setScalar(1.7);
  g.add(head);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 12), mat(tint, { emissive: tint }));
  crown.position.y = 1.1;
  crown.rotation.x = 0.4;
  g.add(crown);
  g.userData.head = head;
  return g;
}

// The candle company's drone cargo barge: PALE & SONS, est. 1712.
export function makeDroneBarge() {
  const g = makeBoatHull('barge');
  // cargo of candle crates
  for (let i = 0; i < 4; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), mat(0xcfc4a8));
    crate.position.set(-6 + i * 4, 1.2, (i % 2) * 2 - 1);
    g.add(crate);
  }
  // drone rotor masts — nobody crews this thing
  for (const x of [-9, 0, 9]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), mat(0x333944));
    mast.position.set(x, 3, 0);
    g.add(mast);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.3), mat(0x556070));
    rotor.position.set(x, 5, 0);
    g.add(rotor);
    (g.userData.rotors = g.userData.rotors || []).push(rotor);
  }
  return g;
}

// The Eel Federation's spark pylon, raised at Blight Corner.
export function makePylon() {
  const g = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 18, 8), mat(0x37474f));
  mast.position.y = 9;
  g.add(mast);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), mat(0x9fdcff, { emissive: 0x3a7fb0 }));
  orb.position.y = 19;
  g.add(orb);
  g.userData.orb = orb;
  return g;
}

// A curious Thames seal — pure delight, zero threat. Now properly plump.
export function makeSeal() {
  const g = new THREE.Group();
  const body = ball(g, 1.0, P8.dusk, 0, 0, 0);            // torpedo body
  body.scale.set(1.9, 0.85, 0.9);
  const chest = ball(g, 0.72, P8.grey, 1.25, 0.1, 0);
  chest.scale.set(1.1, 0.95, 0.95);
  ball(g, 0.5, P8.grey, 1.95, 0.32, 0);                   // head
  const muzzle = ball(g, 0.26, P8.grey, 2.35, 0.2, 0);
  muzzle.scale.set(1.2, 0.8, 0.9);
  ball(g, 0.09, P8.black, 2.6, 0.26, 0);                  // nose
  ball(g, 0.1, P8.black, 2.15, 0.5, 0.2);                 // big dark eyes
  ball(g, 0.1, P8.black, 2.15, 0.5, -0.2);
  for (const s of [1, -1]) {                              // fore flippers
    const f = ball(g, 0.4, P8.grey, 0.7, -0.45, s * 0.6);
    f.scale.set(1.4, 0.25, 0.8);
    f.rotation.z = 0.35; f.rotation.y = s * 0.4;
  }
  const tail = ball(g, 0.5, P8.dusk, -1.5, 0.02, 0);
  tail.scale.set(1.2, 0.7, 0.8);
  const fluke = ball(g, 0.42, P8.grey, -2.0, 0.02, 0);
  fluke.scale.set(0.5, 0.18, 1.5);
  g.userData.tail = tail;
  return g;
}

// The Glitch Canary itself. 🐥 Round, as a duck should be.
export function makeDuck() {
  const g = new THREE.Group();
  const body = ball(g, 0.62, P8.yellow, 0, 0, 0);
  body.scale.set(1.15, 0.85, 0.95);
  ball(g, 0.38, P8.yellow, 0.42, 0.62, 0);                // head
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 12), mat(P8.orange));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.85, 0.55, 0);
  g.add(beak);
  ball(g, 0.07, P8.black, 0.62, 0.75, 0.17);              // eyes
  ball(g, 0.07, P8.black, 0.62, 0.75, -0.17);
  const tail = ball(g, 0.3, P8.yellow, -0.6, 0.15, 0);    // tail tuft
  tail.scale.set(1.1, 0.6, 0.7);
  tail.rotation.z = 0.5;
  return g;
}

// ---------------------------------------------------------------- fauna
export function makeEelHead() {
  const g = new THREE.Group();
  // a sleek muscular head: stretched sphere + smooth tapering snout
  const skull = ball(g, 0.75, P8.green, -0.2, 0, 0);
  skull.scale.set(1.25, 0.9, 0.85);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.8, 16), mat(P8.green));
  snout.rotation.z = -Math.PI / 2;
  snout.position.x = 0.8;
  g.add(snout);
  // sharp teeth: a ring of slender white fangs round the mouth
  for (let i = 0; i < 7; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 8), mat(P8.white));
    const a = (i / 7) * Math.PI * 2;
    t.position.set(1.25, Math.cos(a) * 0.36, Math.sin(a) * 0.36);
    t.rotation.z = Math.PI / 2;
    g.add(t);
  }
  ball(g, 0.15, P8.red, -0.1, 0.42, 0.4, { emissive: 0x880011 });   // eyes
  ball(g, 0.15, P8.red, -0.1, 0.42, -0.4, { emissive: 0x880011 });
  return g;
}

export function makeEelSegment(i) {
  const s = 0.7 - i * 0.055;
  const m = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 10),
    mat(i % 2 ? P8.green : P8.lime));
  m.scale.set(1.5, 1, 1);
  return m;
}

export function makeFatberg(radius = 3) {
  // a greasy organic blob: high-subdivision icosahedron, smoothly lumped
  const geo = new THREE.IcosahedronGeometry(radius, 3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = 1
      + 0.22 * Math.sin(v.x * 1.7 + 3.1) * Math.sin(v.y * 2.1)
      + 0.16 * Math.sin(v.z * 2.4 + v.x * 1.2)
      + 0.08 * Math.sin(v.y * 4.7);
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y * 0.85, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(0xa89f70, { emissive: 0x141c08 }));
  // the documented sweetcorn garnish, now rounded
  for (let i = 0; i < 7; i++) {
    const lump = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(P8.yellow));
    lump.position.setFromSphericalCoords(radius * 0.95,
      Math.random() * Math.PI, Math.random() * Math.PI * 2);
    m.add(lump);
  }
  return m;
}

export function makeMine() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 14), mat(P8.dusk));
  g.add(body);
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 10), mat(P8.grey));
    const v = new THREE.Vector3().setFromSphericalCoords(1.25,
      Math.acos(1 - 2 * ((i + 0.5) / 10)), i * 2.39996);
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
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat(P8.pink, { emissive: 0x662233 }));
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
  // gentle rolling silt dunes — smooth, no steps
  y += (Math.sin(x * 0.11) + Math.cos(z * 0.13)) * 1.2;
  return y;
}

// The surface, seen from below: an animated fragment shader — layered
// travelling waves, a bright sun patch, distance fade. The ceiling of
// the whole world, and it moves.
export function makeWaterSurface(scene) {
  const geo = new THREE.PlaneGeometry(
    (BOUNDS.maxX - BOUNDS.minX) * 1.4, (BOUNDS.maxZ - BOUNDS.minZ) * 1.8, 1, 1);
  geo.rotateX(Math.PI / 2);          // face DOWN at the player
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(0.24, 0.94, 0.12) },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() {
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vW;
      uniform float uTime;
      uniform vec3 uCam;
      uniform vec3 uSunDir;
      void main() {
        vec2 p = vW.xz;
        float t = uTime;
        // layered travelling waves — cheap, endless, never tiles
        float w = 0.0;
        w += sin(p.x * 0.055 + t * 0.9 + sin(p.y * 0.083 - t * 0.6));
        w += sin(p.y * 0.071 - t * 0.7 + sin(p.x * 0.047 + t * 0.8)) * 0.8;
        w += sin((p.x + p.y) * 0.031 + t * 0.5) * 0.6;
        w += sin(length(p) * 0.09 - t * 1.1) * 0.3;
        float shimmer = 0.5 + w * 0.18;
        // the sun through the surface: a soft bright patch
        vec3 toCam = normalize(uCam - vW);
        vec2 sunXZ = uCam.xz + uSunDir.xz / max(uSunDir.y, 0.05) * (-uCam.y);
        float sun = exp(-length(p - sunXZ) * 0.012);
        vec3 col = mix(vec3(0.15, 0.42, 0.62), vec3(0.75, 0.92, 1.0), shimmer * 0.5);
        col += vec3(1.0, 0.95, 0.8) * sun * (0.9 + 0.25 * w);
        // fade with distance so the plane never shows an edge
        float dist = length(vW - uCam);
        float a = clamp(1.4 - dist / 160.0, 0.0, 1.0) * 0.85;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -0.3;
  m.renderOrder = 2;
  scene.add(m);
  return m;
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
  // caustics live IN the floor's fragment shader: animated light webs
  // dancing on the silt, fading out with depth (sunlight runs out)
  const floorMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  floorMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    floorMat.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;')
      .replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
        {
          vec2 cp = vWPos.xz * 0.16;
          float ct = uTime * 0.55;
          float c1 = sin(cp.x + ct + sin(cp.y * 1.31 - ct * 0.73));
          float c2 = sin(cp.y - ct * 0.82 + sin(cp.x * 1.72 + ct));
          float web = pow(max(0.0, c1 * c2), 3.0);
          float sunFade = clamp(1.0 - (-vWPos.y - 34.0) / 28.0, 0.0, 1.0);
          totalEmissiveRadiance += vec3(0.30, 0.55, 0.62) * web * sunFade * 0.75;
        }`);
  };
  const m = new THREE.Mesh(geo, floorMat);
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
  // the walls get a face: an algae band at the waterline, pilaster
  // ribs, and rust streaks — no more featureless navy planes
  const dress = (horizontal, fixed) => {
    const L = horizontal ? (BOUNDS.maxX - BOUNDS.minX) : (BOUNDS.maxZ - BOUNDS.minZ);
    const at = (u, y, w, h, d, color, opts) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(
        horizontal ? w : d, h, horizontal ? d : w), mat(color, opts));
      m.position.set(
        horizontal ? u : fixed, y, horizontal ? fixed : u);
      g.add(m);
    };
    // algae band just under the surface
    at(0, -3, L, 3, 0.5, 0x2e4a33, { emissive: 0x0c1a0e });
    // pilasters
    for (let u = -L / 2 + 9; u < L / 2; u += 19) {
      at(u, -20, 1.4, 44, 0.7, 0x39424e);
    }
    // rust streaks
    for (let i = 0; i < 5; i++) {
      const u = -L / 2 + Math.random() * L;
      at(u, -10 - Math.random() * 12, 1.8, 8 + Math.random() * 12, 0.4, 0x4a3527);
    }
  };
  dress(true, BOUNDS.minZ + 3.2);
  dress(true, BOUNDS.maxZ - 3.2);
  dress(false, BOUNDS.minX + 3.2);
  dress(false, BOUNDS.maxX - 3.2);
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
  box(g, 26, 5, 9, 0x5a3f48, 0, 2, 0);
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
  box(g, 30, 14, 2, 0x4a4050, 0, 7, -10);
  box(g, 30, 9, 2, 0x4a4050, 0, 4.5, 12);
  box(g, 2, 12, 22, 0x4a4050, -15, 6, 1);
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
    new THREE.SphereGeometry(4, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
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
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.24, h, 8),
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

// The world above the water: a Docklands skyline ringing the basin, a
// gradient sky dome, drifting clouds. Grouped so the game can show it
// only when the player is shallow enough to care.
export function makeSky(scene) {
  const g = new THREE.Group();
  // sky dome: warm horizon rising to blue, sun glow baked in
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(330, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      uniforms: { uSun: { value: new THREE.Vector3(0.24, 0.94, 0.12) } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vDir; uniform vec3 uSun;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(vec3(0.95,0.82,0.62), vec3(0.35,0.62,0.92), pow(h, 0.55));
          col += vec3(1.0,0.9,0.7) * pow(max(dot(vDir, normalize(uSun)), 0.0), 60.0) * 0.8;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
  g.add(dome);
  // the skyline: warehouses, towers, gantry cranes — dark shapes on the rim
  let alt = false;
  const sil = (w, h, d, x, z, ry = 0) => {
    alt = !alt;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      mat(alt ? 0x2a3648 : 0x1f2a3a, { fog: false }));
    m.position.set(x, h / 2, z);
    m.rotation.y = ry;
    g.add(m);
    // a few lit windows on the taller blocks: the city is home
    if (h > 12 && Math.random() < 0.7) {
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.2),
          mat(0xd9a441, { emissive: 0x8a6420, fog: false }));
        win.position.set(x + (Math.random() - 0.5) * w * 0.7,
          3 + Math.random() * (h - 5),
          z + (d / 2 + 0.1) * (z > 0 ? -1 : 1));
        g.add(win);
      }
    }
    return m;
  };
  for (let x = -150; x <= 150; x += 18 + Math.random() * 14) {
    sil(10 + Math.random() * 12, 5 + Math.random() * 22, 8, x, BOUNDS.minZ - 30);
    sil(10 + Math.random() * 12, 4 + Math.random() * 16, 8, x, BOUNDS.maxZ + 30);
  }
  for (let z = -70; z <= 70; z += 24 + Math.random() * 12) {
    sil(8, 6 + Math.random() * 24, 10 + Math.random() * 10, BOUNDS.maxX + 34, z);
    sil(8, 4 + Math.random() * 12, 10 + Math.random() * 10, BOUNDS.minX - 34, z);
  }
  // two gantry cranes, the Docklands signature
  for (const [cx, cz] of [[-60, BOUNDS.minZ - 26], [90, BOUNDS.maxZ + 26]]) {
    sil(3, 26, 3, cx, cz);
    const jib = sil(24, 2, 2, cx + 9, cz);
    jib.position.y = 25;
    sil(2, 8, 2, cx + 20, cz).position.y = 20;
  }
  // clouds: big soft sprites on a slow drift
  g.userData.clouds = [];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDot(), color: 0xffffff, transparent: true, opacity: 0.5,
      depthWrite: false, fog: false,
    }));
    c.scale.set(60 + Math.random() * 50, 18 + Math.random() * 10, 1);
    c.position.set((Math.random() - 0.5) * 400, 50 + Math.random() * 40, (Math.random() - 0.5) * 400);
    g.add(c);
    g.userData.clouds.push(c);
  }
  scene.add(g);
  return g;
}

// Underwater horizon interest: looming pilings and wreck ribs near the
// walls, fog-shrouded — the eye always finds a silhouette out there.
export function makeHorizon(scene) {
  const g = new THREE.Group();
  const spots = [[-100, -60], [-95, 50], [110, -50], [40, -70], [-40, 70], [115, 60]];
  for (const [x, z] of spots) {
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const h = 10 + Math.random() * 20;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, h, 10),
        mat(0x1c2836));
      p.position.set(x + (Math.random() - 0.5) * 10,
        floorYAt(x, z) + h / 2, z + (Math.random() - 0.5) * 10);
      p.rotation.z = (Math.random() - 0.5) * 0.15;
      g.add(p);
    }
  }
  // two wreck ribcages: arcs of curved dark ribs
  for (const [x, z, ry] of [[-85, -35, 0.4], [100, 25, -1.1]]) {
    for (let i = 0; i < 7; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(7 - i * 0.2, 0.5, 8, 14, Math.PI), mat(0x22303c));
      rib.position.set(x + i * 2.6 * Math.cos(ry), floorYAt(x, z), z + i * 2.6 * Math.sin(ry));
      rib.rotation.y = ry + Math.PI / 2;
      g.add(rib);
    }
  }
  scene.add(g);
  return g;
}

// The whole static set. Returns collider list for the physics step.
export function buildDock(scene) {
  const floor = makeFloor(scene);
  const surface = makeWaterSurface(scene);
  const sky = makeSky(scene);
  makeHorizon(scene);
  const quay = makeQuayWalls(scene);
  const culverts = makeCulverts(scene);
  const crane = makeCrane(scene);
  const barge = makeBarge(scene);
  const warehouse = makeWarehouse(scene);
  const bell = makeDivingBell(scene);
  const crates = makeCrates(scene);
  const weeds = makeWeeds(scene);
  // signature undertones: each structure family keeps a faint emissive
  // identity — the mystery now comes from light, not wireframes
  tint(quay, 0x1d6f8f, 0.6);
  for (const m of culverts) tint(m.group, 0x00e436, 0.8);
  tint(crane, 0xffa300, 0.3);
  tint(barge, 0xff77a8, 0.25);
  tint(warehouse, 0x83769c, 0.3);
  tint(bell, 0xffec27, 0.9);
  // sphere colliders for the big set pieces (cheap, forgiving)
  const colliders = [
    { x: 60, y: DEEP_Y + 8, z: 40, r: 9 },       // crane base
    { x: -40, y: SHELF_Y + 4, z: 30, r: 10 },    // barge
    { x: 85, y: DEEP_Y + 6, z: -30, r: 11 },     // warehouse
  ];
  return { culverts, crane, barge, warehouse, bell, weeds, colliders, floor, surface, sky };
}

// ---------------------------------------------------------------- particles

export function makeParticleCloud(count, color, size, spread) {
  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) posArr[i] = (Math.random() - 0.5) * spread;
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const m = new THREE.Points(geo, new THREE.PointsMaterial({
    color, size: size * 1.5, transparent: true, opacity: 0.8, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
    map: softDot(),
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
    color: 0xdff6ff, size: 1.15, transparent: true, opacity: 0.0,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    map: softDot(),
  }));
  whale.userData.base = posArr.slice();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softDot(), color: 0xbfeaff, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  core.scale.set(16, 8, 1);
  whale.add(core);
  return whale;
}
