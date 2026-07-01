// "Other flights" — a real one-off ADS-B snapshot of North Atlantic traffic
// (data/flights-snapshot.json, from OpenSky Network) rendered as small
// distant aircraft with contrails scattered through the cruise portion of
// the sky. Real longitude/altitude/heading drive placement; tapping one
// (see ua17-app.js) shows its real altitude/heading/callsign. This is
// flavour ("we're not alone up here!"), not a literal shared-coordinate sim.

import * as THREE from '../vendor/three.module.min.js';
import { flightCurve, CRUISE_ALT } from './ua17-route.js';

// A tiny top-down aircraft silhouette (fuselage sliver + delta wings + tail)
// as one merged geometry — reads as "a plane", not just a dot, even distant.
function silhouetteGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 3.2); // nose
  shape.lineTo(0.3, 1.6);
  shape.lineTo(3.2, -0.6); // right wingtip
  shape.lineTo(0.5, -0.2);
  shape.lineTo(0.9, -2.4); // right tailplane tip
  shape.lineTo(0.22, -1.7);
  shape.lineTo(0, -2.0);
  shape.lineTo(-0.22, -1.7);
  shape.lineTo(-0.9, -2.4); // left tailplane tip
  shape.lineTo(-0.5, -0.2);
  shape.lineTo(-3.2, -0.6); // left wingtip
  shape.lineTo(-0.3, 1.6);
  shape.closePath();
  // A slight extrusion (rather than a flat ShapeGeometry) gives it real
  // faces to catch light from different angles — a flat cutout reads as a
  // paper silhouette that goes invisible edge-on and looks papery face-on.
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // lay flat, nose along +Z
  return geo;
}

function contrailTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

export function buildOtherFlights(snapshot) {
  const { flights, bbox } = snapshot;
  const geo = silhouetteGeometry();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, emissive: 0x9aa4ac, emissiveIntensity: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, flights.length));
  mesh.name = 'ua17-other-flights';

  const contrailGeo = new THREE.PlaneGeometry(1, 1);
  const contrailMat = new THREE.MeshBasicMaterial({ map: contrailTexture(), transparent: true, depthWrite: false, opacity: 0.55 });
  const contrails = new THREE.InstancedMesh(contrailGeo, contrailMat, Math.max(1, flights.length));

  const dummy = new THREE.Object3D();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const point = new THREE.Vector3();
  const positions = []; // world position per instance, kept for tap-metadata callouts

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

    const pos = point.clone()
      .addScaledVector(right, lateral)
      .addScaledVector(tangent, scatterZ);
    pos.y = CRUISE_ALT + altOffset;
    positions.push({ pos: pos.clone(), altitude_m: f.altitude_m, heading: f.heading, callsign: f.callsign });

    const scale = THREE.MathUtils.lerp(5.5, 8.5, Math.random());
    const headingRad = THREE.MathUtils.degToRad(f.heading || 0);

    dummy.position.copy(pos);
    dummy.scale.setScalar(scale);
    dummy.rotation.set(0, headingRad, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    // Contrail: a vertical-facing streak trailing behind, along -heading.
    dummy.position.copy(pos).addScaledVector(new THREE.Vector3(Math.sin(headingRad), 0, Math.cos(headingRad)), -scale * 2.2);
    dummy.scale.set(scale * 1.1, scale * 4.4, 1);
    dummy.rotation.set(0, headingRad, 0);
    dummy.updateMatrix();
    contrails.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = flights.length;
  contrails.instanceMatrix.needsUpdate = true;
  contrails.count = flights.length;

  const group = new THREE.Group();
  group.add(contrails);
  group.add(mesh);
  return { group, mesh, flightsByInstance: positions };
}
