// Cloud field driven by the real weather snapshot fetched in
// tools/fetch-weather.mjs: at each of the ~14 waypoints along the route we
// scatter puff clusters in low/mid/high altitude bands, with cluster COUNT
// proportional to that band's real cloud-cover percentage. Denser real cloud
// cover along a stretch of the route → visibly denser clouds there.
//
// One InstancedMesh for the whole field (hundreds of puffs, one draw call).

import * as THREE from '../vendor/three.module.min.js';
import { flightCurve } from './ua17-route.js';

const BANDS = [
  { key: 'low', yOffset: -300, spread: 120, maxClusters: 5 },
  { key: 'mid', yOffset: -40, spread: 160, maxClusters: 6 },
  { key: 'high', yOffset: 190, spread: 200, maxClusters: 4 },
];
const PUFFS_PER_CLUSTER = 5;

export function buildClouds(weather) {
  // detail=2 + smooth shading reads as a soft puff; detail=1 + flat shading
  // looked like a faceted grey rock under directional light.
  const puffGeo = new THREE.IcosahedronGeometry(1, 2);
  // Slightly transparent: the free-look camera can end up close to (or
  // briefly inside) a puff, and translucent cloud reads as "flying through
  // it" rather than a jarring opaque wall filling the screen.
  const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, transparent: true, opacity: 0.88 });

  // First pass: gather all puff transforms so we can size the InstancedMesh exactly.
  const transforms = [];
  const worldUp = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const point = new THREE.Vector3();

  for (const wp of weather.waypoints) {
    const t = THREE.MathUtils.clamp(wp.t, 0.02, 0.98);
    point.copy(flightCurve.getPointAt(t));
    tangent.copy(flightCurve.getTangentAt(t)).normalize();
    right.crossVectors(worldUp, tangent).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);

    for (const band of BANDS) {
      const pct = wp.cloud[band.key] ?? 0;
      const clusterCount = Math.round((pct / 100) * band.maxClusters);
      for (let c = 0; c < clusterCount; c++) {
        // Keep a clear-ish corridor right around the flight path/chase-camera
        // orbit radius so puffs read as scenery, not a wall the camera keeps
        // clipping into: bias lateral placement away from the centreline.
        const minLateral = 55;
        const lateral = (minLateral + Math.random() * (band.spread - minLateral)) * (Math.random() < 0.5 ? -1 : 1);
        const along = (Math.random() * 2 - 1) * 180;
        const clusterCenter = point.clone()
          .addScaledVector(tangent, along)
          .addScaledVector(right, lateral);
        // Bands sit relative to the path's OWN altitude at this point in the
        // journey (not a fixed cruise height) — otherwise a "low" cloud band
        // ends up right on top of the camera during the low-altitude climb
        // and descent, which reads as a giant white wall filling the screen.
        // Bands that would fall below the ground/ocean during climb/descent
        // are simply skipped rather than dragged up to intrude on the view.
        const bandY = point.y + band.yOffset + (Math.random() * 2 - 1) * 40;
        if (bandY < 20) continue;
        clusterCenter.y = bandY;

        const clusterScale = THREE.MathUtils.lerp(28, 52, Math.random());
        for (let p = 0; p < PUFFS_PER_CLUSTER; p++) {
          const off = new THREE.Vector3(
            (Math.random() * 2 - 1) * clusterScale * 0.8,
            (Math.random() * 0.6) * clusterScale * 0.4,
            (Math.random() * 2 - 1) * clusterScale * 0.8,
          );
          const pos = clusterCenter.clone().add(off);
          const scale = clusterScale * THREE.MathUtils.lerp(0.5, 1.0, Math.random());
          transforms.push({ pos, scale });
        }
      }
    }
  }

  const mesh = new THREE.InstancedMesh(puffGeo, puffMat, Math.max(1, transforms.length));
  const dummy = new THREE.Object3D();
  transforms.forEach((tr, i) => {
    dummy.position.copy(tr.pos);
    dummy.scale.setScalar(tr.scale);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = transforms.length;
  return mesh;
}
