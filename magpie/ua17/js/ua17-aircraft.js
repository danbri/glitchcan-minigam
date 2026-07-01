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
  ctx.fillStyle = '#f5f7fa';
  ctx.fillRect(0, 0, c.width, c.height);
  // cheatline
  ctx.fillStyle = '#0b3d91';
  ctx.fillRect(0, 150, c.width, 26);
  ctx.fillStyle = '#e0222c';
  ctx.fillRect(0, 176, c.width, 6);
  // windows
  ctx.fillStyle = '#2a3a4a';
  for (let x = 24; x < c.width - 24; x += 34) ctx.fillRect(x, 108, 18, 12);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function tailTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b3d91';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e0222c';
  ctx.beginPath();
  ctx.arc(128, 128, 24, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A tapered swept-wing prism: span along +X, chord along +Z, thin along Y.
// Reused (with different dimensions/rotation) for the main wing, tailplane
// and the vertical fin — cheap, low-poly, DoubleSide so winding never matters.
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

export function buildAircraft() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ map: liveryTexture(), roughness: 0.5, metalness: 0.15 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.4, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c2b3a, roughness: 0.15, metalness: 0.6 });
  const tailMat = new THREE.MeshStandardMaterial({ map: tailTexture(), roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide });

  // Fuselage: cylinder aligned to +Z with rounded nose/tail caps.
  const fuseLen = 34, fuseR = 2.5;
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(fuseR, fuseR, fuseLen, 20, 1, true), bodyMat);
  fuse.rotation.x = Math.PI / 2;
  group.add(fuse);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(fuseR, 20, 12), bodyMat);
  nose.scale.set(1, 1, 1.6);
  nose.position.z = fuseLen / 2;
  group.add(nose);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(fuseR * 0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  cockpit.scale.set(1, 0.75, 1.4);
  cockpit.position.set(0, fuseR * 0.25, fuseLen / 2 - 1.6);
  group.add(cockpit);

  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(fuseR, 7, 20), bodyMat);
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.z = -fuseLen / 2 - 3.2;
  group.add(tailCone);

  // Main wings (mirrored pair).
  const wingGeo = wingPrism(16, 7.5, 2.6, 3.2, 0.5);
  const wingR = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.5, side: THREE.DoubleSide }));
  wingR.position.set(fuseR * 0.9, -0.4, 1);
  group.add(wingR);
  const wingL = wingR.clone();
  wingL.scale.x = -1;
  group.add(wingL);

  // Tailplane (horizontal stabiliser, mirrored pair).
  const tailGeo = wingPrism(6.5, 3.6, 1.4, 1.6, 0.35);
  const tailR = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.5, side: THREE.DoubleSide }));
  tailR.position.set(fuseR * 0.5, 0.3, -fuseLen / 2 + 1.5);
  group.add(tailR);
  const tailL = tailR.clone();
  tailL.scale.x = -1;
  group.add(tailL);

  // Vertical fin (livery tail).
  const finGeo = wingPrism(6.5, 5.5, 2, 2.8, 0.4);
  const fin = new THREE.Mesh(finGeo, tailMat);
  fin.rotation.z = Math.PI / 2;
  fin.position.set(0, fuseR * 0.7, -fuseLen / 2 + 1.2);
  group.add(fin);

  // Engines: nacelle + intake ring, hung below each wing on a short pylon.
  function makeEngine() {
    const eg = new THREE.Group();
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 6.5, 16, 1, true), darkMat);
    nacelle.rotation.x = Math.PI / 2;
    eg.add(nacelle);
    const intake = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.28, 8, 20), darkMat);
    intake.position.z = 3.25;
    eg.add(intake);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 2.5), bodyMat);
    pylon.position.y = 2;
    eg.add(pylon);
    return eg;
  }
  const engineR = makeEngine();
  engineR.position.set(6.2, -2.6, 2.5);
  group.add(engineR);
  const engineL = makeEngine();
  engineL.position.set(-6.2, -2.6, 2.5);
  group.add(engineL);

  // Nose already points along local +Z, matching the forward axis used to
  // orient this group in ua17-app.js (no extra rotation needed here).
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return group;
}
