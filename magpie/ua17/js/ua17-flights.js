// "Other flights" — a real one-off ADS-B snapshot of North Atlantic traffic
// (data/flights-snapshot.json, from OpenSky Network) rendered as small
// camera-facing plane blips scattered through the cruise sky. Real
// longitude/altitude/heading drive placement; tapping one (see ua17-app.js)
// shows its real altitude/heading/callsign. Flavour ("we're not alone up
// here!"), not a literal shared-coordinate sim.
//
// Billboarded sprites (not flat 3D cut-outs): a top-down aircraft cut-out
// lying flat in the world is edge-on and invisible from a side chase camera,
// and nearly impossible to tap — a camera-facing sprite always reads as a
// plane and is easy to hit.

import * as THREE from '../vendor/three.module.min.js';
import { flightCurve, CRUISE_ALT } from './ua17-route.js';

function planeSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  ctx.fillStyle = '#f4f7fa';
  ctx.strokeStyle = 'rgba(40,60,90,0.5)';
  ctx.lineWidth = 2;
  // top-down airliner: fuselage + swept wings + tailplane
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(0, -46);            // nose
    ctx.quadraticCurveTo(7, -20, 6, 20);
    ctx.lineTo(4, 40);
    ctx.lineTo(-4, 40);
    ctx.lineTo(-6, 20);
    ctx.quadraticCurveTo(-7, -20, 0, -46);
    ctx.closePath();
  };
  const wings = () => {
    ctx.beginPath();
    ctx.moveTo(5, -6); ctx.lineTo(52, 20); ctx.lineTo(52, 27); ctx.lineTo(4, 12); ctx.closePath();
    ctx.moveTo(-5, -6); ctx.lineTo(-52, 20); ctx.lineTo(-52, 27); ctx.lineTo(-4, 12); ctx.closePath();
  };
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(4, 30); ctx.lineTo(20, 44); ctx.lineTo(20, 48); ctx.lineTo(3, 40); ctx.closePath();
    ctx.moveTo(-4, 30); ctx.lineTo(-20, 44); ctx.lineTo(-20, 48); ctx.lineTo(-3, 40); ctx.closePath();
  };
  wings(); ctx.fill(); ctx.stroke();
  tail(); ctx.fill(); ctx.stroke();
  body(); ctx.fill(); ctx.stroke();
  // blue winglet accents (nod to the United livery on the reference screens)
  ctx.fillStyle = '#2b5fbf';
  ctx.fillRect(49, 18, 5, 10);
  ctx.fillRect(-54, 18, 5, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildOtherFlights(snapshot) {
  const { flights, bbox } = snapshot;
  const group = new THREE.Group();
  const tex = planeSpriteTexture();

  const worldUp = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const point = new THREE.Vector3();
  const lonSpan = Math.max(1e-6, bbox.lomax - bbox.lomin);
  const latSpan = Math.max(1e-6, bbox.lamax - bbox.lamin);

  const sprites = [];
  const meta = [];

  flights.forEach((f) => {
    const u = THREE.MathUtils.clamp((f.lon - bbox.lomin) / lonSpan, 0, 1);
    const v = THREE.MathUtils.clamp((f.lat - bbox.lamin) / latSpan, 0, 1);
    const t = THREE.MathUtils.lerp(0.12, 0.88, u);

    point.copy(flightCurve.getPointAt(t));
    tangent.copy(flightCurve.getTangentAt(t)).normalize();
    right.crossVectors(worldUp, tangent).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);

    const lateral = (v - 0.5) * 1500;
    const altOffset = (f.altitude_m - 11000) / 10;
    const scatterZ = (Math.random() * 2 - 1) * 260;
    const pos = point.clone().addScaledVector(right, lateral).addScaledVector(tangent, scatterZ);
    pos.y = CRUISE_ALT + altOffset;

    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.96 });
    mat.rotation = THREE.MathUtils.degToRad((f.heading || 0) + 180);
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    const s = THREE.MathUtils.lerp(16, 26, Math.random());
    sprite.scale.set(s, s, 1);
    const info = { pos: pos.clone(), altitude_m: f.altitude_m, heading: f.heading, callsign: f.callsign };
    sprite.userData.info = info;
    group.add(sprite);
    sprites.push(sprite);
    meta.push(info);
  });

  return { group, sprites, flightsByInstance: meta };
}
