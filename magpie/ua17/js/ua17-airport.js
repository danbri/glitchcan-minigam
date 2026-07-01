// A simple runway + apron at each end of the route so climb-out and final
// approach both read as "a real airport", not "the plane just appears near
// some buildings". Purely decorative geometry — no real airport layout data.

import * as THREE from '../vendor/three.module.min.js';

function runwayTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3d40';
  ctx.fillRect(0, 0, c.width, c.height);
  // edge lines
  ctx.fillStyle = '#e7e9ec';
  ctx.fillRect(6, 0, 5, c.height);
  ctx.fillRect(c.width - 11, 0, 5, c.height);
  // dashed centreline
  for (let y = 20; y < c.height - 20; y += 46) ctx.fillRect(c.width / 2 - 3, y, 6, 26);
  // threshold bars at both ends (a runway is approached/departed from either end)
  const threshold = (y0) => {
    for (let i = 0; i < 5; i++) ctx.fillRect(16 + i * 20, y0, 12, 34);
  };
  threshold(18);
  threshold(c.height - 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
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
  const geo = new THREE.SphereGeometry(0.45, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const group = new THREE.Group();
  const count = Math.round(length / 24);
  for (let i = 0; i <= count; i++) {
    const z = -length / 2 + (i / count) * length;
    [-width / 2 - 1.5, width / 2 + 1.5].forEach((x) => {
      const light = new THREE.Mesh(geo, mat);
      light.position.set(x, 0.4, z);
      group.add(light);
    });
  }
  return group;
}

export function buildRunway(worldZ, headingRad, worldX = 0) {
  const group = new THREE.Group();
  const length = 260, width = 34;

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 5, length * 1.6),
    new THREE.MeshStandardMaterial({ color: 0x7a8066, roughness: 0.95 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.3;
  group.add(apron);

  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.9 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = -0.15;
  group.add(strip);

  group.add(edgeLights(length, width));

  const term = terminal();
  term.position.set(width * 1.8, 0, -length * 0.15);
  group.add(term);

  group.rotation.y = headingRad;
  group.position.set(worldX, 0, worldZ);
  return group;
}
