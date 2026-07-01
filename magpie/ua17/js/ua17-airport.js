// A simple runway + apron at each end of the route so climb-out and final
// approach both read as "a real airport", not "the plane just appears near
// some buildings". Purely decorative geometry — no real airport layout data.

import * as THREE from '../vendor/three.module.min.js';

function runwayTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 2048;
  const ctx = c.getContext('2d');
  // Mid-grey asphalt (not near-black) so the runway doesn't visually dominate
  // the whole scene, with softer off-white markings.
  ctx.fillStyle = '#565a5f';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#c6cace';
  ctx.fillRect(7, 0, 4, c.height);
  ctx.fillRect(c.width - 11, 0, 4, c.height);
  // dashed centreline
  for (let y = 40; y < c.height - 40; y += 60) ctx.fillRect(c.width / 2 - 2, y, 5, 30);
  // threshold "piano key" bars at both ends
  const threshold = (y0) => {
    for (let i = 0; i < 5; i++) ctx.fillRect(16 + i * 20, y0, 12, 40);
  };
  threshold(26);
  threshold(c.height - 70);
  // touchdown-zone aiming markers a little in from each threshold
  const aim = (y0) => { ctx.fillRect(30, y0, 14, 60); ctx.fillRect(c.width - 44, y0, 14, 60); };
  aim(120); aim(c.height - 180);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function terminal() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(46, 9, 16),
    new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.6 }),
  );
  body.position.y = 4.5;
  g.add(body);
  const glassBand = new THREE.Mesh(
    new THREE.BoxGeometry(46.2, 3, 16.2),
    new THREE.MeshStandardMaterial({ color: 0x6fa8c9, roughness: 0.2, metalness: 0.4 }),
  );
  glassBand.position.y = 6.5;
  g.add(glassBand);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.6, 20, 10),
    new THREE.MeshStandardMaterial({ color: 0xcfd4d8, roughness: 0.6 }),
  );
  tower.position.set(-28, 10, 4);
  g.add(tower);
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.6, 3.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x6fa8c9, roughness: 0.2, metalness: 0.5 }),
  );
  cab.position.set(-28, 21.5, 4);
  g.add(cab);
  return g;
}

function edgeLights(length, width) {
  // Flat inset fixtures flush with the asphalt, evenly spaced — reads as
  // "embedded runway lights", not floating sprite dots hovering in mid-air.
  const geo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 10);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  const group = new THREE.Group();
  const count = Math.round(length / 22);
  for (let i = 0; i <= count; i++) {
    const z = -length / 2 + (i / count) * length;
    [-width / 2 - 1.2, width / 2 + 1.2].forEach((x) => {
      const light = new THREE.Mesh(geo, mat);
      light.position.set(x, 0.06, z); // seated in the ground, top just proud
      group.add(light);
    });
  }
  return group;
}

export function buildRunway(worldZ, headingRad, worldX = 0, length = 900) {
  const group = new THREE.Group();
  const width = 40;

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 6, length * 1.25),
    new THREE.MeshStandardMaterial({ color: 0x6f7560, roughness: 0.96 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.35;
  group.add(apron);

  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.9 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = -0.12;
  group.add(strip);

  // A parallel taxiway alongside, for that "real airport" read.
  const taxiway = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.55, length * 0.9),
    new THREE.MeshStandardMaterial({ color: 0x40474b, roughness: 0.95 }),
  );
  taxiway.rotation.x = -Math.PI / 2;
  taxiway.position.set(width * 1.5, -0.14, 0);
  group.add(taxiway);

  group.add(edgeLights(length, width));

  const term = terminal();
  term.position.set(width * 2.6, 0, -length * 0.12);
  group.add(term);

  group.rotation.y = headingRad;
  group.position.set(worldX, 0, worldZ);
  return group;
}
