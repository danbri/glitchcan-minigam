// A procedural, generic long-haul widebody twinjet in a friendly blue livery
// (evocative, not a scan of any real aircraft or trademarked logo — see
// data/flight-info.json for the "stylised" note). Built entirely from three.js
// primitives + a couple of runtime canvas textures, so there is nothing to
// download and nothing that can go missing offline.

import * as THREE from '../vendor/three.module.min.js';

function liveryTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfcfe';
  ctx.fillRect(0, 0, c.width, c.height);
  // cheatline
  ctx.fillStyle = '#0b3d91';
  ctx.fillRect(0, 158, c.width, 18);
  ctx.fillStyle = '#e0222c';
  ctx.fillRect(0, 178, c.width, 5);
  // windows: a slim, evenly spaced row with soft rounded corners feels far
  // less "flat 90s clip-art" than plain hard-edged rectangles.
  ctx.fillStyle = '#26313d';
  const winW = 13, winH = 9, gap = 20;
  for (let x = 30; x < c.width - 30; x += gap) {
    const r = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, 118, winW, winH, r);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function tailTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#123a8f');
  g.addColorStop(1, '#0b2c6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(128, 128, 60, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e0222c';
  ctx.beginPath();
  ctx.arc(128, 128, 22, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A tapered swept-wing prism: span along +X, chord along +Z, thin along Y.
// Reused (with different dimensions) for the main wing, tailplane, fin and
// winglets — cheap, low-poly, DoubleSide so winding never matters.
function wingPrism(span, rootChord, tipChord, sweep, thickness) {
  const h = thickness / 2;
  const rLE = [0, h, rootChord * 0.55];
  const rTE = [0, h, -rootChord * 0.45];
  const tLE = [span, h, rootChord * 0.55 - sweep];
  const tTE = [span, h, rootChord * 0.55 - sweep - tipChord];
  const positions = [
    ...rLE, ...rTE, ...tTE, ...tLE,
    [rLE[0], -h, rLE[2]], [rTE[0], -h, rTE[2]], [tTE[0], -h, tTE[2]], [tLE[0], -h, tLE[2]],
  ].flat();
  const idx = [
    0, 1, 2, 0, 2, 3, // top
    4, 6, 5, 4, 7, 6, // bottom
    3, 2, 6, 3, 6, 7, // tip
    0, 3, 7, 0, 7, 4, // leading edge
    1, 2, 6, 1, 6, 5, // trailing edge
    0, 1, 5, 0, 5, 4, // root
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// A tapered tube (nose -> constant cabin -> tail) lathed around its own axis,
// then rotated so that axis runs along +Z. Reads as a real fuselage instead
// of the previous cylinder-with-sphere-caps "pill" silhouette.
function fuselageGeometry(length, radius) {
  const half = length / 2;
  const profile = [
    [0.0, -half - 3.4],
    [radius * 0.25, -half - 1.6],
    [radius * 0.85, -half],
    [radius, -half + 5],
    [radius, half - 12],
    [radius * 0.94, half - 6],
    [radius * 0.7, half - 2],
    [radius * 0.32, half + 0.6],
    [0.0, half + 2.4],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 28);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function mirroredPair(geo, material, x, y, z, dihedral = 0) {
  const group = new THREE.Group();
  const right = new THREE.Mesh(geo, material);
  right.position.set(x, y, z);
  right.rotation.z = dihedral;
  group.add(right);
  const left = new THREE.Mesh(geo, material);
  left.position.set(-x, y, z);
  left.scale.x = -1;
  left.rotation.z = -dihedral;
  group.add(left);
  return { group, right, left };
}

function makeWheel(radius) {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, radius * 0.6, 12),
    new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.7 }),
  );
  wheel.rotation.x = Math.PI / 2;
  return wheel;
}

function makeLandingGear(fuseR) {
  const gear = new THREE.Group();
  const strutMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.35, metalness: 0.5 });

  function leg(height) {
    return new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, height, 8), strutMat);
  }

  // Nose gear.
  const nose = new THREE.Group();
  const noseLeg = leg(3.2);
  noseLeg.position.y = -1.6;
  nose.add(noseLeg);
  const noseWheel = makeWheel(0.7);
  noseWheel.position.y = -3.1;
  nose.add(noseWheel);
  nose.position.set(0, -fuseR * 0.9, 9);
  gear.add(nose);

  // Main gear (mirrored pair, two wheels each — reads as "heavy jet" not "toy plane").
  function mainLeg() {
    const g = new THREE.Group();
    const l = leg(4.2);
    l.position.y = -2.1;
    g.add(l);
    [-0.55, 0.55].forEach((dz) => {
      const w = makeWheel(0.85);
      w.position.set(0, -4.1, dz);
      g.add(w);
    });
    return g;
  }
  const mainR = mainLeg();
  mainR.position.set(fuseR * 1.1, -fuseR * 0.9, -1.5);
  gear.add(mainR);
  const mainL = mainLeg();
  mainL.position.set(-fuseR * 1.1, -fuseR * 0.9, -1.5);
  gear.add(mainL);

  return gear;
}

export function buildAircraft() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({ map: liveryTexture(), roughness: 0.45, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.35, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x17222e, roughness: 0.1, metalness: 0.7 });
  const tailMat = new THREE.MeshStandardMaterial({ map: tailTexture(), roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide });

  const fuseLen = 34, fuseR = 2.5;
  const fuse = new THREE.Mesh(fuselageGeometry(fuseLen, fuseR), bodyMat);
  group.add(fuse);

  // Cockpit windows: a small dark band set back from the nose (not a big black
  // sphere at the very tip, which read as a "black blob nose").
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(fuseR * 0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  cockpit.scale.set(0.85, 0.55, 1.1);
  cockpit.position.set(0, fuseR * 0.5, fuseLen / 2 - 1.4);
  group.add(cockpit);

  // Main wings: swept, tapered, gentle dihedral, with upturned winglets —
  // the single biggest cue that separates "toy silhouette" from "airliner".
  const wingGeo = wingPrism(16, 7.5, 2.6, 3.6, 0.45);
  const { group: wings, right: wingR, left: wingL } = mirroredPair(wingGeo, wingMat, fuseR * 0.85, -0.6, 0.5, 0.06);
  group.add(wings);

  const wingletGeo = wingPrism(2.6, 2.3, 0.7, 1.3, 0.28);
  [wingR, wingL].forEach((wing, i) => {
    const winglet = new THREE.Mesh(wingletGeo, wingMat);
    winglet.position.set(16, 0, -3.6);
    winglet.rotation.z = (i === 0 ? 1 : -1) * 1.15;
    wing.add(winglet);
  });

  // Tailplane (horizontal stabiliser, mirrored pair).
  const tailGeo = wingPrism(6.5, 3.6, 1.4, 1.9, 0.35);
  const { group: tailplane } = mirroredPair(tailGeo, wingMat, fuseR * 0.45, 0.4, -fuseLen / 2 + 1.8, 0.05);
  group.add(tailplane);

  // Vertical fin (livery tail).
  const finGeo = wingPrism(6.8, 5.6, 2, 3.1, 0.4);
  const fin = new THREE.Mesh(finGeo, tailMat);
  fin.rotation.z = Math.PI / 2;
  fin.position.set(0, fuseR * 0.65, -fuseLen / 2 + 1.4);
  group.add(fin);

  // Engines: nacelle + intake ring + rear cone, hung below each wing on a pylon.
  function makeEngine() {
    const eg = new THREE.Group();
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.4, 6.8, 20, 1, true), darkMat);
    nacelle.rotation.x = Math.PI / 2;
    eg.add(nacelle);
    const intake = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.26, 10, 24), new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.3, metalness: 0.7 }));
    intake.position.z = 3.4;
    eg.add(intake);
    const fanFace = new THREE.Mesh(new THREE.CircleGeometry(1.35, 20), new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.6 }));
    fanFace.position.z = 3.35;
    eg.add(fanFace);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 2.6), bodyMat);
    pylon.position.y = 2.1;
    eg.add(pylon);
    return eg;
  }
  const engineR = makeEngine();
  engineR.position.set(6.4, -3.0, 2.2);
  group.add(engineR);
  const engineL = makeEngine();
  engineL.position.set(-6.4, -3.0, 2.2);
  group.add(engineL);

  // Landing gear — shown near the ground, hidden at cruise (see ua17-app.js).
  const landingGear = makeLandingGear(fuseR);
  group.add(landingGear);

  // Nav lights: tiny red/green wingtip beacons + a small blinking tail beacon.
  // Kept very small so they don't read as stray floating dots at distance.
  const navMat = (color) => new THREE.MeshBasicMaterial({ color });
  const navGeo = new THREE.SphereGeometry(0.11, 6, 5);
  const redLight = new THREE.Mesh(navGeo, navMat(0xff2a2a));
  redLight.position.set(18.4, 0, -3.6);
  wingL.add(redLight);
  const greenLight = new THREE.Mesh(navGeo, navMat(0x2aff6a));
  greenLight.position.set(18.4, 0, -3.6);
  wingR.add(greenLight);
  // Small tail-fin beacon (blinks via userData.beacon in the loop).
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), navMat(0xff5555));
  beacon.position.set(0, fuseR * 0.65 + 6.6, -fuseLen / 2 + 1.4);
  group.add(beacon);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  group.userData.landingGear = landingGear;
  group.userData.beacon = beacon;
  return group;
}
