// "Other flights" — a real one-off ADS-B snapshot of North Atlantic traffic
// (data/flights-snapshot.json, from OpenSky Network) rendered as small
// distant blips scattered through the cruise portion of the sky. Real
// longitude/altitude drive placement; this is flavour ("we're not alone up
// here!"), not a literal shared-coordinate simulation.

import * as THREE from '../vendor/three.module.min.js';
import { flightCurve, CRUISE_ALT } from './ua17-route.js';

function blipGeometry() {
  // A tiny flattened dart shape reads fine as a distant aircraft silhouette.
  const geo = new THREE.ConeGeometry(1, 4, 4);
  geo.rotateX(Math.PI / 2);
  geo.scale(0.5, 0.18, 1);
  return geo;
}

export function buildOtherFlights(snapshot) {
  const { flights, bbox } = snapshot;
  const geo = blipGeometry();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x222222 });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, flights.length));

  const dummy = new THREE.Object3D();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const point = new THREE.Vector3();

  const lonSpan = Math.max(1e-6, bbox.lomax - bbox.lomin);
  const latSpan = Math.max(1e-6, bbox.lamax - bbox.lamin);

  flights.forEach((f, i) => {
    const u = THREE.MathUtils.clamp((f.lon - bbox.lomin) / lonSpan, 0, 1);
    const v = THREE.MathUtils.clamp((f.lat - bbox.lamin) / latSpan, 0, 1);
    const t = THREE.MathUtils.lerp(0.12, 0.88, u);

    point.copy(flightCurve.getPointAt(t));
    tangent.copy(flightCurve.getTangentAt(t)).normalize();
    right.crossVectors(worldUp, tangent).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);

    const lateral = (v - 0.5) * 1400;
    const altOffset = (f.altitude_m - 11000) / 12; // metres -> scene units, gentle spread
    const scatterZ = (Math.random() * 2 - 1) * 250;

    dummy.position.copy(point)
      .addScaledVector(right, lateral)
      .addScaledVector(tangent, scatterZ);
    dummy.position.y = CRUISE_ALT + altOffset;
    dummy.scale.setScalar(THREE.MathUtils.lerp(8, 14, Math.random()));
    dummy.rotation.set(0, THREE.MathUtils.degToRad(f.heading || 0), 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = flights.length;
  return mesh;
}
