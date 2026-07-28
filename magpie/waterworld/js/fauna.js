// Waterworld fauna — the life that makes looking UP worth it: moored
// hulls hanging in the ceiling light, a dolphin pod that breaches the
// surface, sharks that circle out of curiosity (Thames sharks are real
// and mostly eat crabs), and bright reef fish darting round the wrecks.
// Ambience with presence; the only gameplay it touches is wonder.

import * as THREE from '../../../trees/vendor/three.module.min.js';
import {
  BOUNDS, floorYAt, makeBoatHull, makeDolphin, makeShark, makeReefFish,
} from './world.js';
import { currentAt, glowSprite } from './fx.js';

const _v = new THREE.Vector3();

// ── the swimmer's craft (classic animation principles, procedurally) ──
// Every creature that swims gets the same four truths applied after its
// brain has chosen a direction:
//   ARCS      heading turns at a bounded rate, so paths curve;
//   SOLIDITY  the body BANKS into the turn (roll follows yaw rate);
//   STRETCH   the body stretches along travel with speed, squashes when
//             it brakes — volume roughly conserved;
//   TIMING    the tail beats faster and shallower the faster it swims —
//             weight lives in tempo (sharks slow and heavy, fish quick
//             and light).
// The models are authored head-along-X (lookAt + rotateY(-π/2)), so the
// long axis is local X: roll = rotateX, stretch = scale.x.
function swimPose(m, u, dt, speed, opts) {
  const yaw = Math.atan2(m.getWorldDirection(_v).x, _v.z); // heading after lookAt
  if (u.prevYaw === undefined) u.prevYaw = yaw;
  let dYaw = yaw - u.prevYaw;
  if (dYaw > Math.PI) dYaw -= Math.PI * 2;
  if (dYaw < -Math.PI) dYaw += Math.PI * 2;
  u.prevYaw = yaw;
  // bank into the turn, smoothed so it settles rather than snaps
  const targetBank = THREE.MathUtils.clamp((dYaw / Math.max(dt, 1e-3)) * opts.bank, -0.55, 0.55);
  u.bank = (u.bank || 0) + (targetBank - (u.bank || 0)) * Math.min(1, dt * 6);
  m.rotateX(u.bank);
  // stretch with speed, settle with a little follow-through
  const targetStretch = THREE.MathUtils.clamp(speed * opts.stretch, 0, 0.22);
  u.stretch = (u.stretch || 0) + (targetStretch - (u.stretch || 0)) * Math.min(1, dt * 5);
  const s = 1 + u.stretch, c = 1 / Math.sqrt(s);
  m.scale.set(s, c, c);
}

export class Fauna {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.lite = !!opts.lite;

    // --- moored boats at the surface, each swinging round its mooring
    this.hulls = [];
    const moorings = [
      { kind: 'barge', x: -25, z: 55 },
      { kind: 'tug', x: 30, z: -50 },
      { kind: 'narrowboat', x: 75, z: 25 },
    ];
    for (const m of moorings) {
      const h = makeBoatHull(m.kind);
      h.position.set(m.x, -0.35, m.z);
      h.rotation.y = Math.random() * Math.PI;
      h.userData.home = { x: m.x, z: m.z };
      h.userData.phase = Math.random() * 9;
      scene.add(h);
      this.hulls.push(h);
    }
    // crude but honest colliders so the sub can bump a hull
    this.colliders = this.hulls.map(h => ({
      x: h.position.x, y: -1.5, z: h.position.z,
      r: h.userData.spec.beam * 0.9 + 2,
    }));

    // --- the dolphin pod: a leader on an endless curve, two followers
    this.dolphins = [];
    for (let i = 0; i < 3; i++) {
      const d = makeDolphin();
      d.userData.irColor = 0xcc7744;      // warm-blooded, like the seal
      d.userData.lag = i * 0.55;
      scene.add(d);
      this.dolphins.push(d);
    }
    this._podT = Math.random() * 20;

    // --- sharks: slow deep patrols, occasionally curious
    this.sharks = [];
    const beats = [
      { cx: 55, cz: 20, rx: 45, rz: 30, y: -20 },
      { cx: -20, cz: -30, rx: 55, rz: 28, y: -16 },
    ];
    for (let i = 0; i < (this.lite ? 1 : 2); i++) {
      const s = makeShark();
      s.userData.irColor = 0x44586e;      // cold fish, faint trace
      scene.add(s);
      this.sharks.push({
        mesh: s, beat: beats[i % beats.length],
        phase: Math.random() * 9, curious: 0, angle: 0, windup: 0,
      });
    }

    // --- reef fish: bright loners round the wrecks
    this.fish = [];
    const fishColors = [0xff7a3c, 0xffd23c, 0x3cc8ff, 0xff5ca8, 0x7dff6e, 0xb48cff];
    const homes = [[-40, 30], [60, 40], [85, -30], [-70, -20], [10, 55]];
    const n = this.lite ? 6 : 12;
    for (let i = 0; i < n; i++) {
      const f = makeReefFish(fishColors[i % fishColors.length]);
      const [hx, hz] = homes[i % homes.length];
      const home = new THREE.Vector3(
        hx + (Math.random() - 0.5) * 14,
        floorYAt(hx, hz) + 3 + Math.random() * 6,
        hz + (Math.random() - 0.5) * 14);
      f.position.copy(home);
      f.userData.home = home;
      f.userData.target = home.clone();
      f.userData.phase = Math.random() * 9;
      this.scene.add(f);
      this.fish.push(f);
    }
  }

  // Returns proximity events for the game to narrate.
  step(dt, t, sub) {
    const out = { dolphinsNear: false, sharksNear: false };

    // hulls: bob, roll a little, swing slowly round the mooring
    for (const h of this.hulls) {
      const u = h.userData;
      h.position.y = -0.35 + Math.sin(t * 0.5 + u.phase) * 0.14;
      h.rotation.z = Math.sin(t * 0.4 + u.phase * 2) * 0.03;
      h.rotation.y += dt * 0.012;
      h.position.x = u.home.x + Math.sin(t * 0.05 + u.phase) * 2.5;
      h.position.z = u.home.z + Math.cos(t * 0.045 + u.phase) * 2.5;
    }
    for (let i = 0; i < this.hulls.length; i++) {
      this.colliders[i].x = this.hulls[i].position.x;
      this.colliders[i].z = this.hulls[i].position.z;
    }

    // dolphins: the pod arcs through the upper water and BREACHES —
    // through the surface sheet and back with a roll of the fluke.
    // Principles at work: the fluke KICKS hardest on the way up
    // (exaggeration at the apex of the arc), the body stretches with
    // speed and banks through the wide curve, and the breach throws a
    // splash of spray (secondary action) as it punches the sheet.
    this._podT += dt * 0.55;
    for (const d of this.dolphins) {
      const u = d.userData;
      const k = this._podT - u.lag;
      const px = -10 + 75 * Math.sin(k * 0.35);
      const pz = 45 * Math.sin(k * 0.23 + 1.3);
      const py = -3.8 + 4.4 * Math.sin(k * 1.15);   // tops out ABOVE the sheet
      _v.set(px, Math.min(py, 1.0), pz);
      const step = _v.clone().sub(d.position);
      const wasY = d.position.y;
      d.position.lerp(_v, 1 - Math.pow(0.001, dt));
      if (step.lengthSq() > 0.001) {
        d.lookAt(d.position.clone().add(step));
        d.rotateY(-Math.PI / 2);
      }
      const speed = step.length() / Math.max(dt, 1e-3) * (1 - Math.pow(0.001, dt));
      swimPose(d, u, dt, speed, { bank: 0.14, stretch: 0.028 });
      // the kick: rising = power stroke (big, driving), falling = glide
      const rising = d.position.y > wasY;
      const amp = rising ? 0.62 : 0.28;
      u.fluke.rotation.z = Math.sin(t * (rising ? 8.5 : 5.5) + u.lag * 4) * amp;
      // breach spray when punching up through the sheet
      if (wasY < -0.2 && d.position.y >= -0.2) this._splash(d.position);
      if (d.position.distanceTo(sub) < 24) out.dolphinsNear = true;
    }

    // sharks: patrol an ellipse; if the sub is close, circle IT a while.
    // Principles at work: a shark is HEAVY — it turns on a bounded
    // radius (its heading eases toward the target, so pursuit paths are
    // curved, never kinked), its tail beats slow and deep, and before it
    // breaks patrol to come and look at you there is a WIND-UP — half a
    // second of hanging in the water with the tail gathering — so the
    // approach is announced, not teleported (anticipation).
    for (const s of this.sharks) {
      const m = s.mesh;
      const u = m.userData;
      let target;
      const dSub = m.position.distanceTo(sub);
      if (s.windup > 0) {
        s.windup -= dt;
        // hangs in the water; the tail does the talking. COPY, not
        // alias: the clamp below writes target.y, and writing through
        // an alias of m.position would teleport the shark.
        target = _v.copy(m.position);
        if (s.windup <= 0) s.curious = 11;
      } else if (s.curious > 0) {
        s.curious -= dt;
        s.angle += dt * 0.7;
        target = _v.set(sub.x + Math.cos(s.angle) * 8,
          sub.y + 1.5 + Math.sin(s.angle * 1.7), sub.z + Math.sin(s.angle) * 8);
      } else {
        if (dSub < 16 && Math.sin(t * 0.11 + s.phase) > 0.55) { s.windup = 0.55; s.angle = Math.atan2(m.position.z - sub.z, m.position.x - sub.x); }
        s.phase += dt * 0.14;
        target = _v.set(
          s.beat.cx + Math.cos(s.phase) * s.beat.rx,
          s.beat.y + Math.sin(s.phase * 1.9) * 4,
          s.beat.cz + Math.sin(s.phase) * s.beat.rz);
      }
      target.y = Math.max(floorYAt(target.x, target.z) + 3, Math.min(-3, target.y));
      const step = target.clone().sub(m.position);
      const dist = step.length();
      let speed = 0;
      if (dist > 0.3) {
        // heading eases toward the goal: arcs, not kinks
        if (!u.dir) u.dir = step.clone().normalize();
        u.dir.lerp(step.normalize(), Math.min(1, dt * 1.6)).normalize();
        speed = Math.min(7.5, dist);
        m.position.addScaledVector(u.dir, speed * dt);
        m.lookAt(m.position.clone().add(u.dir));
        m.rotateY(-Math.PI / 2);
      }
      swimPose(m, u, dt, speed, { bank: 0.2, stretch: 0.02 });
      // slow, deep strokes; gathering ones during the wind-up
      const winding = s.windup > 0;
      u.tail.rotation.y = Math.sin(t * (winding ? 1.6 : 2.8) + s.phase) * (winding ? 0.8 : 0.55);
      if (dSub < 15) out.sharksNear = true;
    }

    // reef fish: hop between spots near home, flee the sub.
    // Principles at work: a reef fish is LIGHT — it DARTS (a burst of
    // stretch and frantic tail on takeoff, ease-out into the new spot)
    // and hangs almost still between hops, tail idling. The contrast
    // between burst and idle is the timing that says "small and quick";
    // sharks say "large and heavy" by never bursting at all.
    for (const f of this.fish) {
      const u = f.userData;
      if (f.position.distanceTo(u.target) < 1 || Math.random() < dt * 0.25) {
        u.target.copy(u.home).add(_v.set(
          (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 12));
        u.burst = 0.3;                      // takeoff: a beat of effort
      }
      const fromSub = f.position.distanceTo(sub);
      if (fromSub < 6) {
        u.target.copy(f.position).addScaledVector(
          _v.copy(f.position).sub(sub).normalize(), 10);
        u.burst = 0.45;                     // flight is a bigger effort
      }
      u.target.y = Math.max(floorYAt(u.target.x, u.target.z) + 1.5, Math.min(-2.5, u.target.y));
      if (u.burst > 0) u.burst -= dt;
      const step = _v.copy(u.target).sub(f.position);
      const dist = step.length();
      let speed = 0;
      if (dist > 0.2) {
        speed = Math.min(fromSub < 6 ? 9 : 2.6, dist * 2);   // ease-out arrival
        f.position.addScaledVector(step.normalize(), speed * dt);
        f.lookAt(f.position.clone().add(step));
        f.rotateY(-Math.PI / 2);
      }
      swimPose(f, u, dt, speed * (u.burst > 0 ? 2.2 : 1), { bank: 0.1, stretch: 0.03 });
      // the gyre nudges everyone
      currentAt(f.position, t, _v);
      f.position.addScaledVector(_v, 0.3 * dt);
      // frantic on the burst, idling flicks at rest
      const bursting = u.burst > 0;
      u.tail.rotation.y = Math.sin(t * (bursting ? 14 : 6.5) + u.phase) * (bursting ? 0.8 : 0.35);
    }

    // breach spray: retire spent droplets
    if (this._spray) {
      for (let i = this._spray.length - 1; i >= 0; i--) {
        const p = this._spray[i];
        p.life -= dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.y -= 14 * dt;                 // gravity above the sheet
        p.mesh.material.opacity = Math.max(0, p.life * 1.6);
        if (p.life <= 0) { this.scene.remove(p.mesh); this._spray.splice(i, 1); }
      }
    }

    return out;
  }

  // A handful of bright droplets thrown up where a dolphin punches the
  // surface — secondary action: the world answers the motion.
  _splash(at) {
    this._spray = this._spray || [];
    if (this._spray.length > 24) return;    // pool cap; breaches overlap
    for (let i = 0; i < 6; i++) {
      const m = glowSprite(0xbfe8ff, 0.9 + Math.random() * 0.8, 0.85);
      m.position.set(at.x + (Math.random() - 0.5), 0.1, at.z + (Math.random() - 0.5));
      this.scene.add(m);
      this._spray.push({
        mesh: m, life: 0.5 + Math.random() * 0.25,
        vel: new THREE.Vector3((Math.random() - 0.5) * 3, 4 + Math.random() * 3, (Math.random() - 0.5) * 3),
      });
    }
  }
}
