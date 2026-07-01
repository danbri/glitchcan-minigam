// Cloud field driven by the real weather snapshot fetched in
// tools/fetch-weather.mjs: at each of the ~14 waypoints along the route we
// scatter puff clusters in low/mid/high altitude bands, with cluster COUNT
// proportional to that band's real cloud-cover percentage. Denser real cloud
// cover along a stretch of the route → visibly denser clouds there.
//
// In addition to that scenery, a line of "gate" puffs sits right on the
// flight path at cruise so the plane actually flies THROUGH clouds — each
// gate pops in a glittering burst (see ua17-particles.js) on contact.
//
// One InstancedMesh for the whole field (hundreds of puffs, one draw call).
// buildClouds returns { mesh, clusters, setClusterScale } so the app can
// detect a hit (plane within a cluster's radius) and dissolve that cluster.

import * as THREE from '../vendor/three.module.min.js';
import { flightCurve } from './ua17-route.js';

const BANDS = [
  { key: 'low', yOffset: -300, spread: 120, maxClusters: 5 },
  { key: 'mid', yOffset: -40, spread: 160, maxClusters: 6 },
  { key: 'high', yOffset: 190, spread: 200, maxClusters: 4 },
];
const PUFFS_PER_CLUSTER = 5;

export function buildClouds(weather) {
  const puffGeo = new THREE.IcosahedronGeometry(1, 2);
  const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, transparent: true, opacity: 0.9 });

  const worldUp = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const point = new THREE.Vector3();

  // clusterSpecs: {center, scale, gate} — gates sit on the path to be punched.
  const clusterSpecs = [];

  // 1) Scenery clusters, off to the sides, density from the real weather.
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
        const minLateral = 70;
        const lateral = (minLateral + Math.random() * (band.spread - minLateral)) * (Math.random() < 0.5 ? -1 : 1);
        const along = (Math.random() * 2 - 1) * 180;
        const bandY = point.y + band.yOffset + (Math.random() * 2 - 1) * 40;
        if (bandY < 20) continue;
        const center = point.clone().addScaledVector(tangent, along).addScaledVector(right, lateral);
        center.y = bandY;
        clusterSpecs.push({ center, scale: THREE.MathUtils.lerp(30, 54, Math.random()), gate: false });
      }
    }
  }

  // 2) Gate clusters ON the path at cruise, spaced along the journey — these
  // are the ones the plane flies through and pops.
  const GATES = 14;
  for (let i = 0; i < GATES; i++) {
    const t = THREE.MathUtils.lerp(0.16, 0.82, i / (GATES - 1));
    point.copy(flightCurve.getPointAt(t));
    tangent.copy(flightCurve.getTangentAt(t)).normalize();
    right.crossVectors(worldUp, tangent).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    const center = point.clone()
      .addScaledVector(right, (Math.random() * 2 - 1) * 14)
      .addScaledVector(tangent, (Math.random() * 2 - 1) * 40);
    center.y = point.y + (Math.random() * 2 - 1) * 12;
    clusterSpecs.push({ center, scale: THREE.MathUtils.lerp(24, 34, Math.random()), gate: true });
  }

  // Build per-instance transforms and remember which belong to each cluster.
  const instances = []; // {pos, scale, rot}
  const clusters = [];
  for (const spec of clusterSpecs) {
    const ids = [];
    for (let p = 0; p < PUFFS_PER_CLUSTER; p++) {
      const off = new THREE.Vector3(
        (Math.random() * 2 - 1) * spec.scale * 0.8,
        (Math.random() * 0.6) * spec.scale * 0.4,
        (Math.random() * 2 - 1) * spec.scale * 0.8,
      );
      ids.push(instances.length);
      instances.push({
        pos: spec.center.clone().add(off),
        scale: spec.scale * THREE.MathUtils.lerp(0.5, 1.0, Math.random()),
        rot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0),
      });
    }
    clusters.push({ center: spec.center.clone(), radius: spec.scale * 1.25, gate: spec.gate, popped: false, dissolve: 1, instanceIds: ids });
  }

  const mesh = new THREE.InstancedMesh(puffGeo, puffMat, Math.max(1, instances.length));
  const dummy = new THREE.Object3D();
  instances.forEach((it, i) => {
    dummy.position.copy(it.pos);
    dummy.scale.setScalar(it.scale);
    dummy.rotation.copy(it.rot);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = instances.length;

  // Rescale one cluster's puffs (used to shrink a cluster away as it pops).
  function setClusterScale(cluster, factor) {
    for (const id of cluster.instanceIds) {
      const it = instances[id];
      dummy.position.copy(it.pos);
      dummy.scale.setScalar(it.scale * factor);
      dummy.rotation.copy(it.rot);
      dummy.updateMatrix();
      mesh.setMatrixAt(id, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, clusters, setClusterScale };
}
