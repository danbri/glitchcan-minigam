// Waterworld fauna — the life that makes looking UP worth it: moored
// hulls hanging in the ceiling light, a dolphin pod that breaches the
// surface, sharks that circle out of curiosity (Thames sharks are real
// and mostly eat crabs), and bright reef fish darting round the wrecks.
// Ambience with presence; the only gameplay it touches is wonder.

import * as THREE from '../../../trees/vendor/three.module.min.js';
import {
  BOUNDS, floorYAt, makeBoatHull, makeDolphin, makeShark, makeReefFish,
} from './world.js';
import { currentAt } from './fx.js';

const _v = new THREE.Vector3();

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
        phase: Math.random() * 9, curious: 0, angle: 0,
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
    // through the surface sheet and back with a roll of the fluke
    this._podT += dt * 0.55;
    for (const d of this.dolphins) {
      const k = this._podT - d.userData.lag;
      const px = -10 + 75 * Math.sin(k * 0.35);
      const pz = 45 * Math.sin(k * 0.23 + 1.3);
      const py = -3.8 + 4.4 * Math.sin(k * 1.15);   // tops out ABOVE the sheet
      _v.set(px, Math.min(py, 1.0), pz);
      const step = _v.clone().sub(d.position);
      d.position.lerp(_v, 1 - Math.pow(0.001, dt));
      if (step.lengthSq() > 0.001) {
        d.lookAt(d.position.clone().add(step));
        d.rotateY(-Math.PI / 2);
      }
      d.userData.fluke.rotation.z = Math.sin(t * 7 + d.userData.lag * 4) * 0.4;
      if (d.position.distanceTo(sub) < 24) out.dolphinsNear = true;
    }

    // sharks: patrol an ellipse; if the sub is close, circle IT a while
    for (const s of this.sharks) {
      const m = s.mesh;
      let target;
      const dSub = m.position.distanceTo(sub);
      if (s.curious > 0) {
        s.curious -= dt;
        s.angle += dt * 0.7;
        target = _v.set(sub.x + Math.cos(s.angle) * 8,
          sub.y + 1.5 + Math.sin(s.angle * 1.7), sub.z + Math.sin(s.angle) * 8);
      } else {
        if (dSub < 16 && Math.sin(t * 0.11 + s.phase) > 0.55) s.curious = 11;
        s.phase += dt * 0.14;
        target = _v.set(
          s.beat.cx + Math.cos(s.phase) * s.beat.rx,
          s.beat.y + Math.sin(s.phase * 1.9) * 4,
          s.beat.cz + Math.sin(s.phase) * s.beat.rz);
      }
      target.y = Math.max(floorYAt(target.x, target.z) + 3, Math.min(-3, target.y));
      const step = target.clone().sub(m.position);
      const dist = step.length();
      if (dist > 0.3) {
        m.position.addScaledVector(step.normalize(), Math.min(7.5, dist) * dt);
        m.lookAt(m.position.clone().add(step));
        m.rotateY(-Math.PI / 2);
      }
      m.userData.tail.rotation.y = Math.sin(t * 4.5 + s.phase) * 0.45;
      if (dSub < 15) out.sharksNear = true;
    }

    // reef fish: hop between spots near home, flee the sub
    for (const f of this.fish) {
      const u = f.userData;
      if (f.position.distanceTo(u.target) < 1 || Math.random() < dt * 0.25) {
        u.target.copy(u.home).add(_v.set(
          (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 12));
      }
      const fromSub = f.position.distanceTo(sub);
      if (fromSub < 6) {
        u.target.copy(f.position).addScaledVector(
          _v.copy(f.position).sub(sub).normalize(), 10);
      }
      u.target.y = Math.max(floorYAt(u.target.x, u.target.z) + 1.5, Math.min(-2.5, u.target.y));
      const step = _v.copy(u.target).sub(f.position);
      const dist = step.length();
      if (dist > 0.2) {
        const speed = fromSub < 6 ? 9 : 2.6;
        f.position.addScaledVector(step.normalize(), Math.min(speed, dist * 2) * dt);
        f.lookAt(f.position.clone().add(step));
        f.rotateY(-Math.PI / 2);
      }
      // the gyre nudges everyone
      currentAt(f.position, t, _v);
      f.position.addScaledVector(_v, 0.3 * dt);
      f.userData.tail.rotation.y = Math.sin(t * 9 + u.phase) * 0.6;
    }

    return out;
  }
}
